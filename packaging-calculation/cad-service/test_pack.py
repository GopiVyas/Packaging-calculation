"""Real-shape packing tests (Phase 4):  python test_pack.py
The overlap check needs `pip install manifold3d` (exact mesh booleans)."""
import base64
import io
import itertools
from pathlib import Path

import numpy as np
import trimesh
from fastapi.testclient import TestClient

from app import app
from pack import pack

client = TestClient(app)
SAMPLES = Path(__file__).parent / "samples"


def mesh_of(name):
    with open(SAMPLES / f"{name}.step", "rb") as f:
        d = client.post("/analyze", files={"file": (f"{name}.step", f)}).json()
    return trimesh.load(io.BytesIO(base64.b64decode(d["glbBase64"])), file_type="glb", force="mesh"), d


def check(name, carton, min_count):
    mesh, _ = mesh_of(name)
    r = pack(mesh, [{"id": "C", "innerL": carton[0], "innerW": carton[1], "innerH": carton[2]}], resolution=64)
    for m in r["cartons"][0]["methods"]:
        assert m["count"] >= min_count, (name, m["name"], m["count"])
        T = np.array(m["matrix"]).reshape(4, 4)
        copies = []
        for p in m["placements"][:40]:
            M = T.copy()
            M[:3, 3] += p
            c = mesh.copy()
            c.apply_transform(M)
            assert np.all(c.bounds[0] > -0.01) and np.all(c.bounds[1] < np.array(carton) + 0.01), "copy outside the carton"
            copies.append(c)
        for a, b in itertools.combinations(copies, 2):
            if np.all(a.bounds[1] > b.bounds[0]) and np.all(b.bounds[1] > a.bounds[0]):
                inter = trimesh.boolean.intersection([a, b], engine="manifold")
                assert inter is None or len(inter.faces) == 0 or inter.volume < 0.01, f"{name}: copies overlap"
    return r


def test_tray_nests():
    # Box packing fits 2 × 2 × 7 = 28 trays (Ø200 × 40) in 420 × 420 × 300; nested trays stack at ~22 mm.
    r = check("tray", (420, 420, 300), min_count=40)
    assert all(m["nested"] for m in r["cartons"][0]["methods"])


def test_never_worse_than_box():
    # Clamp 66 × 38 × 65: box packing gives 6 × 7 × 4 = 168 in 400 × 300 × 263.
    check("clamp", (400, 300, 263), min_count=168)


def test_bracket_clusters():
    # L-bracket 120 × 80 × 60: box packing gives 50 in 400 × 300 × 263; four brackets turned 180°
    # interlock into one block, so Cluster Packing must do much better — with no overlap.
    mesh, _ = mesh_of("bracket")
    carton = (400, 300, 263)
    r = pack(mesh, [{"id": "C", "innerL": carton[0], "innerW": carton[1], "innerH": carton[2]}], resolution=64, clusters=True)
    assert r["clusters"] and r["clusters"][0]["vsLoose"] > 150
    m = next(x for x in r["cartons"][0]["methods"] if x["id"] == "cluster")
    assert m["count"] >= 100, m["count"]
    copies = []
    for row in m["copies"][:24]:
        M = np.eye(4)
        M[:3] = np.array(row).reshape(3, 4)
        c = mesh.copy()
        c.apply_transform(M)
        assert np.all(c.bounds[0] > -0.01) and np.all(c.bounds[1] < np.array(carton) + 0.01), "copy outside the carton"
        copies.append(c)
    for a, b in itertools.combinations(copies, 2):
        if np.all(a.bounds[1] > b.bounds[0]) and np.all(b.bounds[1] > a.bounds[0]):
            inter = trimesh.boolean.intersection([a, b], engine="manifold")
            assert inter is None or len(inter.faces) == 0 or inter.volume < 0.01, "cluster pieces overlap"


def test_pack_endpoint():
    _, d = mesh_of("tray")
    glb = base64.b64decode(d["glbBase64"])
    r = client.post("/pack", files={"file": ("model.glb", glb)}, data={"request": '{"cartons":[{"id":"A","innerL":420,"innerW":420,"innerH":300}],"preset":"standard"}'})
    assert r.status_code == 200, r.text
    assert r.json()["cartons"][0]["methods"][0]["count"] >= 40


if __name__ == "__main__":
    for fn in (test_tray_nests, test_never_worse_than_box, test_bracket_clusters, test_pack_endpoint):
        fn()
        print("ok", fn.__name__)


def test_tray_nests_on_real_surface():
    """Thin-walled tapered tray: exact stacking must nest far tighter than the 40 mm height."""
    import trimesh as _t
    from app import read_step, shape_to_mesh
    mesh = shape_to_mesh(read_step(str(Path(__file__).parent / "samples" / "tray.step")))
    import pack as _p
    G, T, ext = _p.voxel_model(mesh, _p.rotations(False)[0], 3.125)
    d = _p.exact_stack_pitch(mesh, T)
    assert d is not None and 9.0 <= d <= 11.0


def test_clusters_fill_leftover_space_with_single_parts():
    """Clamp pairs are 112 mm long; a 154 mm carton leaves 42 mm that single clamps must fill."""
    from app import read_step, shape_to_mesh
    mesh = shape_to_mesh(read_step(str(Path(__file__).parent / "samples" / "clamp.step")))
    r = pack(mesh, [{"id": "S1", "innerL": 154, "innerW": 149, "innerH": 190}], budget_s=40, clusters=True)
    cl = next(m for m in r["cartons"][0]["methods"] if m["id"] == "cluster")
    assert cl["count"] >= 26 and cl.get("singles", 0) >= 1
    assert len(cl["copies"]) == cl["count"]
