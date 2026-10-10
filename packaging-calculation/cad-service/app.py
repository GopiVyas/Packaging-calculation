"""
CAD service (Phase 2): reads a STEP (or STL) file and returns what section 2 "Part" shows.

  POST /analyze   multipart "file"  ->  JSON:
      format, solids, volumeMm3, areaMm2, bbox {l,w,h}, triangles, watertight,
      orientation ("as-drawn" | "rotated"), glbBase64 (3D model for the browser, mm, min corner at 0,0,0)

Units: millimetres. STEP files are converted to mm by OpenCascade whatever unit they were saved in.
Run:  uvicorn app:app --host 127.0.0.1 --port 8000
"""
import base64
import os
import tempfile

import numpy as np
import trimesh
import io
import json

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from pack import pack as pack_part

from OCP.BRep import BRep_Tool
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.Bnd import Bnd_Box
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS

def _s(cls, name):
    """OpenCascade static methods are called Name_s in older OCP builds and Name in OCP 8+."""
    return getattr(cls, name + "_s", None) or getattr(cls, name)


MAX_BYTES = int(os.environ.get("CAD_MAX_MB", "50")) * 1024 * 1024
app = FastAPI(title="Packaging Solution CAD service")


@app.get("/health")
def health():
    return {"ok": True}


def read_step(path):
    _s(Interface_Static, "SetCVal")("xstep.cascade.unit", "MM")
    reader = STEPControl_Reader()
    if reader.ReadFile(path) != IFSelect_RetDone:
        raise HTTPException(400, "This file could not be read as STEP.")
    reader.TransferRoots()
    shape = reader.OneShape()
    if shape is None or shape.IsNull():
        raise HTTPException(400, "The STEP file contains no geometry.")
    return shape


def shape_to_mesh(shape):
    box = Bnd_Box()
    _s(BRepBndLib, "Add")(shape, box)
    # CornerMin/CornerMax work across OCP versions (Get() changed its return type).
    p0, p1 = box.CornerMin(), box.CornerMax()
    diag = float(np.linalg.norm([p1.X() - p0.X(), p1.Y() - p0.Y(), p1.Z() - p0.Z()]))
    # Finer mesh for small parts, coarser for large ones (keeps the browser fast).
    BRepMesh_IncrementalMesh(shape, max(0.01, diag / 1500), False, 0.35, True)

    verts, faces, offset = [], [], 0
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = _s(TopoDS, "Face")(exp.Current())
        loc = TopLoc_Location()
        tri = _s(BRep_Tool, "Triangulation")(face, loc)
        if tri is not None:
            trsf = loc.Transformation()
            n = tri.NbNodes()
            for i in range(1, n + 1):
                p = tri.Node(i).Transformed(trsf)
                verts.append((p.X(), p.Y(), p.Z()))
            reversed_ = face.Orientation() == TopAbs_REVERSED
            for i in range(1, tri.NbTriangles() + 1):
                a, b, c = tri.Triangle(i).Get()
                faces.append((offset + a - 1, offset + c - 1, offset + b - 1) if reversed_ else (offset + a - 1, offset + b - 1, offset + c - 1))
            offset += n
        exp.Next()
    if not faces:
        raise HTTPException(400, "The STEP file has no surfaces that can be meshed.")
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    mesh.merge_vertices()
    return mesh


def exact_props(shape):
    vp, sp = GProp_GProps(), GProp_GProps()
    _s(BRepGProp, "VolumeProperties")(shape, vp)
    _s(BRepGProp, "SurfaceProperties")(shape, sp)
    solids = 0
    exp = TopExp_Explorer(shape, TopAbs_SOLID)
    while exp.More():
        solids += 1
        exp.Next()
    return abs(vp.Mass()), sp.Mass(), solids


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"File is larger than {MAX_BYTES // 1024 // 1024} MB.")
    name = file.filename or "part"
    ext = os.path.splitext(name)[1].lower()
    if ext not in (".step", ".stp", ".stl"):
        raise HTTPException(400, "Upload a STEP (.step / .stp) or STL file.")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        if ext == ".stl":
            mesh = trimesh.load(path, force="mesh")
            mesh.merge_vertices()
            volume = float(abs(mesh.volume)) if mesh.is_watertight else None
            area, solids, fmt = float(mesh.area), 1, "STL"
        else:
            shape = read_step(path)
            mesh = shape_to_mesh(shape)
            volume, area, solids = exact_props(shape)
            fmt = "STEP"
    finally:
        os.unlink(path)

    # Packing position: keep the part as drawn unless a turned position gives a clearly smaller box.
    aabb = mesh.extents
    orientation = "as-drawn"
    try:
        to_origin, obb = trimesh.bounds.oriented_bounds(mesh)
        if np.prod(obb) < 0.97 * np.prod(aabb):
            mesh.apply_transform(to_origin)
            orientation = "rotated"
    except Exception:  # noqa: BLE001 - keep as drawn if the fit fails
        pass

    mesh.apply_translation(-mesh.bounds[0])  # min corner at 0,0,0
    l, w, h = (float(v) for v in mesh.extents)
    if volume is None or volume <= 0:
        volume = float(abs(mesh.volume)) if mesh.is_watertight else None

    glb = mesh.export(file_type="glb")
    return {
        "fileName": name,
        "format": fmt,
        "solids": solids,
        "volumeMm3": round(volume, 2) if volume else None,
        "areaMm2": round(area, 2),
        "bbox": {"l": round(l, 2), "w": round(w, 2), "h": round(h, 2)},
        "triangles": int(len(mesh.faces)),
        "watertight": bool(mesh.is_watertight),
        "orientation": orientation,
        "glbBase64": base64.b64encode(glb).decode("ascii"),
    }


RESOLUTION = {"standard": 64, "thorough": 96}
CLUSTER_RESOLUTION = {"standard": 40, "thorough": 56}


@app.post("/pack")
async def pack_endpoint(file: UploadFile = File(...), request: str = Form(...)):
    """
    Real-shape packing (Phase 4). multipart:
      file    = the part's model.glb (as produced by /analyze: mm, Z up, min corner 0)
      request = JSON {cartons: [{id, innerL, innerW, innerH}], upright, preset, budgetS}
    """
    try:
        req = json.loads(request)
        cartons = [{"id": str(c["id"]), "innerL": float(c["innerL"]), "innerW": float(c["innerW"]), "innerH": float(c["innerH"])} for c in req["cartons"]]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Bad request: {e}")
    data = await file.read()
    try:
        mesh = trimesh.load(io.BytesIO(data), file_type="glb", force="mesh")
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "The 3D model could not be read")
    if mesh.is_empty:
        raise HTTPException(400, "The 3D model is empty")
    preset = req.get("preset", "standard")
    return pack_part(mesh, cartons, upright=bool(req.get("upright")), resolution=RESOLUTION.get(preset, 64),
                     budget_s=float(req.get("budgetS", 60)), max_placements=int(req.get("maxPlacements", 1500)),
                     clusters=bool(req.get("clusters", True)), cluster_resolution=CLUSTER_RESOLUTION.get(preset, 40))
