"""
Real-shape packing (Phase 4): how many copies of the actual part fit in a carton when copies
are allowed to nest into each other. Works on a voxel model of the part (solid, mm grid).

Two methods, both regular lattices of identical copies (same orientation, translation only):

  Column Stacking   — side by side at the bounding-box pitch; vertically each copy may sink into
                      the one below, with a sideways offset ("staircase"), found from height maps.
  Repeating Pattern — like Column Stacking, but copies may also nest side by side (X and Y pitch
                      found from side profiles).

Every lattice is checked voxel by voxel against its neighbours. The voxel model is conservative
(every voxel the surface touches counts as solid), so copies never overlap; nesting found at a
coarse resolution is a little less tight than reality. Voxel size = longest side / resolution.
"""
import math
import time

import numpy as np
import trimesh
from scipy import ndimage

# The voxel model is conservative: a voxel counts as part if the surface touches it at all, so two
# copies whose voxels don't overlap can't overlap in reality (they may just touch, like stacked trays).
GAP = 0


def rotations(upright):
    """Proper rotations that put each axis of the part upright (6), or only turns about Z (2)."""
    I = np.eye(3)
    rz = np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]])  # 90° about Z
    rx = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])  # 90° about X (Y up)
    ry = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])  # 90° about Y (X up)
    base = [I, rz] if upright else [I, rz, rx, rz @ rx, ry, rz @ ry]
    return [np.asarray(r, dtype=float) for r in base]


def voxel_model(mesh, R, h, return_origin=False):
    """Rotate, move to min corner 0 and voxelize. Returns (solid grid [x,y,z], 4×4 transform, true extents)."""
    T = np.eye(4)
    T[:3, :3] = R
    m = mesh.copy()
    m.apply_transform(T)
    shift = -m.bounds[0]
    m.apply_translation(shift)
    T[:3, 3] = shift
    vox = m.voxelized(pitch=h)
    try:
        vox = vox.fill()
    except Exception:  # noqa: BLE001 - open meshes keep their shell; still conservative
        pass
    grid = np.asarray(vox.matrix, dtype=bool)
    if not grid.any():
        raise ValueError("The part could not be voxelized")
    # trim empty borders so index 0 is the first occupied voxel
    idx = np.argwhere(grid)
    lo, hi = idx.min(0), idx.max(0) + 1
    grid = grid[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    if return_origin:  # mm position of the lower corner of voxel (0, 0, 0), used by clusters
        origin = np.asarray(vox.transform)[:3, 3] + lo * h - h / 2
        return grid, T, m.extents.astype(float), origin
    return grid, T, m.extents.astype(float)


def collide(A, B, s):
    """Does grid B shifted by s (voxels) overlap grid A?"""
    sa, sb = [], []
    for d, n, m in zip(s, A.shape, B.shape):
        if d >= n or -d >= m:
            return False
        sa.append(slice(max(d, 0), min(n, m + d)))
        sb.append(slice(max(-d, 0), min(m, n - d)))
    return bool(np.any(A[tuple(sa)] & B[tuple(sb)]))


def lattice_ok(G, Gd, v):
    """Lattice vectors v = [(px,0,0), (ox,py,0), (sx,sy,pz)] (voxels): no copy touches the origin copy."""
    nx, ny, nz = G.shape
    (px, _, _), (ox, py, _), (sx, sy, pz) = v
    rk = math.ceil(nz / pz) + 1
    rj = math.ceil(ny / py) + math.ceil(rk * abs(sy) / py) + 1
    ri = math.ceil(nx / px) + math.ceil((rj * abs(ox) + rk * abs(sx)) / px) + 1
    for k in range(0, rk + 1):
        for j in range(-rj, rj + 1):
            for i in range(-ri, ri + 1):
                if (k, j, i) <= (0, 0, 0):  # each pair once (symmetry) and skip the copy itself
                    continue
                s = (i * px + j * ox + k * sx, j * py + k * sy, k * pz)
                if abs(s[0]) < nx and abs(s[1]) < ny and abs(s[2]) < nz and collide(Gd, G, s):
                    return False
    return True


CUBE = np.ones((3, 3, 3), dtype=bool)


def side_pitch(G, Gd, axis):
    """Smallest translation along one axis so copy B clears copy A (A grown by the gap), row by row."""
    occ_b = G.any(axis=axis)
    occ_a = Gd.any(axis=axis)
    first_b = np.argmax(G, axis=axis)
    n = G.shape[axis]
    last_a = n - 1 - np.argmax(np.flip(Gd, axis=axis), axis=axis)
    both = occ_a & occ_b
    return int(np.max((last_a + 1 - first_b)[both])) if both.any() else 1


def stack_candidates(G, Gd, search, search_y=None):
    """Vertical lattice vectors (sx, sy, pz), best first: the copy above sinks into the one below
    as far as the height maps allow, for every sideways offset within `search` voxels."""
    nx, ny, nz = G.shape
    occ_a, occ_b = Gd.any(axis=2), G.any(axis=2)
    top = np.where(occ_a, nz - np.argmax(Gd[:, :, ::-1], axis=2), -10**6)  # A (with gap): highest + 1
    bot = np.where(occ_b, np.argmax(G, axis=2), 10**6)  # B: lowest
    out = []
    for sx in range(-min(search, nx - 1), min(search, nx - 1) + 1):
        sy_lim = min(search if search_y is None else search_y, ny - 1)
        for sy in range(-sy_lim, sy_lim + 1):
            a = top[max(sx, 0):nx + min(sx, 0), max(sy, 0):ny + min(sy, 0)]
            b = bot[max(-sx, 0):nx - max(sx, 0), max(-sy, 0):ny - max(sy, 0)]
            both = (a > -10**5) & (b < 10**5)
            pz = max(1, int(np.max(a[both] - b[both]))) if both.any() else 1
            out.append((pz, abs(sx) + abs(sy), sx, sy))
    out.sort()
    return [(sx, sy, pz) for pz, _, sx, sy in out]


def row_candidates(G, Gd, search):
    """Second lattice vector (ox, py, 0): the next row along Y, offset along X by ox (teeth between teeth)."""
    Gt, Gdt = G.transpose(0, 2, 1), Gd.transpose(0, 2, 1)  # treat Y as "up"
    return [(sx, pz) for sx, _, pz in stack_candidates(Gt, Gdt, search, search_y=0)]


def solve_lattice(G0, method, deadline):
    """Lattice vectors (voxels) for one method, or None when nothing nests (plain box grid is as good)."""
    G = np.pad(G0, 1)
    Gd = ndimage.binary_dilation(G, structure=CUBE, iterations=GAP) if GAP else G
    nx, ny, nz = G0.shape
    full = (nx + GAP, ny + GAP, nz + GAP)
    rows = [(0, full[1])]
    px = full[0]
    if method == "pattern":
        px = min(full[0], side_pitch(G, Gd, 0))
        rows = [(ox, min(py, full[1])) for ox, py in row_candidates(G, Gd, nx // 2)[:12]] + rows
    stacks = stack_candidates(G, Gd, search=max(nx, ny) // 2)[:60]
    best, best_density = None, 1.0 / (full[0] * full[1] * full[2])  # must beat the plain grid
    for ox, py in rows:
        for sx, sy, pz in stacks:
            if time.monotonic() > deadline:
                return best
            pz = min(pz, full[2])
            density = 1.0 / (px * py * pz)
            if density <= best_density:
                continue
            # A staircase drifts sideways layer by layer, so neighbouring columns may need extra room.
            for vx, vy in ((px, py), (max(px, full[0] + abs(sx) + abs(ox)), max(py, full[1] + abs(sy)))):
                v = [(vx, 0, 0), (ox, vy, 0), (sx, sy, pz)]
                if 1.0 / (vx * vy * pz) > best_density and lattice_ok(G, Gd, v):
                    best, best_density = v, 1.0 / (vx * vy * pz)
                    break
    return best


def count_in(inner, ext, vec_mm):
    """Copies of the lattice that fit in the carton (inner l, w, h mm).
    Rows along Y are offset by (j · ox) mod px, so a staggered pattern alternates instead of drifting.
    Layers drift by (sx, sy) per layer. Returns (count, layout, used height)."""
    (px, _, _), (ox, py, _), (sx, sy, pz) = vec_mm
    best = (0, None, 0.0)
    if any(e > i + 1e-6 for e, i in zip(ext, inner)):
        return best
    max_k = int((inner[2] - ext[2]) // pz) + 1 if pz > 0 else 1
    max_j = int((inner[1] - ext[1]) // py) + 1 if py > 0 else 1
    for nk in range(1, max_k + 1):
        drift_x, drift_y = (nk - 1) * abs(sx), (nk - 1) * abs(sy)
        if inner[0] - ext[0] - drift_x < -1e-6:
            break
        row_off, rows = [], []
        for j in range(max_j):
            if ext[1] + j * py + drift_y > inner[1] + 1e-6:
                break
            off = (j * ox) % px if px > 0 else 0.0
            avail = inner[0] - ext[0] - drift_x - off
            if avail < -1e-6:
                rows.append(0)
            else:
                rows.append(int((avail + 1e-6) // px) + 1)
            row_off.append(off)
        n = nk * sum(rows)
        if n > best[0]:
            layout = {"layers": nk, "rows": rows, "rowOffsets": row_off,
                      "origin": ((nk - 1) * max(0.0, -sx), (nk - 1) * max(0.0, -sy))}
            best = (n, layout, (nk - 1) * pz + ext[2])
    return best


METHODS = [("column", "Column Stacking"), ("pattern", "Repeating Pattern")]

# Exact stacking: clearance kept between nested copies (mm), on top of the ray sampling.
STACK_CLEARANCE = 0.3


def ray_intervals(m, step):
    """Vertical rays on an (x, y) grid through the mesh (already placed at min corner 0).
    Returns (nx, ny, list of z-interval arrays per ray): where along each ray the part is solid."""
    ex = m.extents
    xs = np.arange(step / 2, ex[0], step)
    ys = np.arange(step / 2, ex[1], step)
    ny = len(ys)
    per = [[] for _ in range(len(xs) * ny)]
    # Vertical rays need no ray library: for each triangle, the grid points inside its (x, y)
    # projection, and the surface height there (barycentric interpolation).
    for tri in m.triangles:
        (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = tri
        det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(det) < 1e-12:  # vertical face: seen edge-on by vertical rays
            continue
        i0 = max(0, int(math.ceil((min(x0, x1, x2) - step / 2) / step - 1e-9)))
        i1 = min(len(xs) - 1, int(math.floor((max(x0, x1, x2) - step / 2) / step + 1e-9)))
        j0 = max(0, int(math.ceil((min(y0, y1, y2) - step / 2) / step - 1e-9)))
        j1 = min(ny - 1, int(math.floor((max(y0, y1, y2) - step / 2) / step + 1e-9)))
        if i1 < i0 or j1 < j0:
            continue
        I, J = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1), indexing="ij")
        px, py = xs[I], ys[J]
        a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / det
        b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / det
        c = 1 - a - b
        inside = (a >= -1e-9) & (b >= -1e-9) & (c >= -1e-9)
        for i, j, z in zip(I[inside], J[inside], (a * z0 + b * z1 + c * z2)[inside]):
            per[i * ny + j].append(z)
    out = []
    for hits in per:
        hits = np.unique(np.round(np.sort(hits), 4))
        if len(hits) % 2:  # grazing hit: treat the whole span as solid (safe side)
            hits = np.array([hits[0], hits[-1]]) if len(hits) > 1 else np.array([])
        out.append(hits.reshape(-1, 2))
    return len(xs), len(ys), out


def _forbidden(A, nx, ny, i_off, j_off):
    """Open intervals of vertical shift d where a copy moved by (i_off, j_off) rays and d overlaps."""
    spans = []
    for i in range(max(0, i_off), min(nx, nx + i_off)):
        for j in range(max(0, j_off), min(ny, ny + j_off)):
            a = A[i * ny + j]
            b = A[(i - i_off) * ny + (j - j_off)]
            if len(a) and len(b):
                lo = a[:, 0][:, None] - b[:, 1][None, :]
                hi = a[:, 1][:, None] - b[:, 0][None, :]
                spans.append(np.column_stack([lo.ravel(), hi.ravel()]))
    return np.concatenate(spans) if spans else np.zeros((0, 2))


def _clear(F, d, margin):
    return not np.any((F[:, 0] - margin < d) & (d < F[:, 1] + margin))


def exact_stack_pitch(mesh, T, resolution_mm=None):
    """Smallest vertical pitch (mm) at which identical copies, straight above each other, nest
    without touching — computed on the real surface with vertical rays, not voxels.
    Every copy in the column (not only the next one) is checked. Returns None if no nesting."""
    m = mesh.copy()
    m.apply_transform(T)
    ex = m.extents
    step = resolution_mm or max(0.5, float(max(ex[0], ex[1])) / 220)
    nx, ny, A = ray_intervals(m, step)
    F = _forbidden(A, nx, ny, 0, 0)
    if not len(F):
        return None
    margin = STACK_CLEARANCE
    # candidate pitches: just above the end of each forbidden span
    cands = np.unique(np.concatenate([[0.0], F[:, 1] + margin + 1e-3]))
    cands = cands[(cands > 0) & (cands < ex[2] - 1e-6)]
    for d in cands:
        if not _clear(F, d, margin):
            continue
        k_max = int(math.ceil(ex[2] / d)) + 1
        if all(_clear(F, k * d, margin) for k in range(2, k_max + 1)):
            return float(d)
    return None


def pack(mesh, cartons, upright=False, resolution=64, budget_s=60, max_placements=1500, clusters=False, cluster_resolution=40):
    """
    cartons: [{id, innerL, innerW, innerH}] (mm).  Returns per carton, per method, the best orientation.
    """
    t0 = time.monotonic()
    deadline = t0 + budget_s
    h = float(max(mesh.extents)) / resolution
    lattices = []  # (method, R, T, ext, vec_mm, computeMs)
    timed_out = False
    for R in rotations(upright):
        if time.monotonic() > deadline:
            timed_out = True
            break
        G, T, ext = voxel_model(mesh, R, h)
        box = [(ext[0], 0, 0), (0, ext[1], 0), (0, 0, ext[2])]
        found = {}
        # Exact straight stack on the real surface (thin-walled trays, cups, buckets): columns at the
        # bounding-box pitch, each copy sinking into the one below as far as the geometry allows.
        exact = None
        if time.monotonic() < deadline:
            t1 = time.monotonic()
            try:
                d = exact_stack_pitch(mesh, T)
            except Exception:  # noqa: BLE001 - ray casting failed on a bad mesh; voxels still work
                d = None
            if d is not None and d < ext[2] - 1.0:  # worth it only when copies really sink in
                exact = ([(ext[0], 0, 0), (0, ext[1], 0), (0, 0, d)], (time.monotonic() - t1) * 1000)
        for mid, _ in METHODS:
            t1 = time.monotonic()
            v = solve_lattice(G, mid, deadline)
            ms = (time.monotonic() - t1) * 1000
            found[mid] = [tuple(float(c) * h for c in vec) for vec in v] if v is not None else None
            # The plain grid at the exact part size is always a candidate, so nesting can only add;
            # Repeating Pattern also tries the Column Stacking lattice (it is a superset).
            for cand in [box, found.get("column"), found[mid], exact[0] if exact else None]:
                if cand is not None:
                    lattices.append((mid, T, ext, cand, ms))
                    ms = 0
    out = []
    for c in cartons:
        inner = (c["innerL"], c["innerW"], c["innerH"])
        methods = []
        for mid, name in METHODS:
            best = None
            ms = 0.0
            for (m, T, ext, vec, cms) in lattices:
                if m != mid:
                    continue
                ms += cms
                n, layout, used_h = count_in(inner, ext, vec)
                if best is None or n > best["count"]:
                    best = {"count": n, "layout": layout, "T": T, "ext": ext, "vec": vec, "usedH": used_h}
            if best is None:
                continue
            placements = []
            if best["count"]:
                (px, _, _), (ox, py, _), (sx, sy, pz) = best["vec"]
                L = best["layout"]
                for k in range(L["layers"]):
                    for j, (n_row, off) in enumerate(zip(L["rows"], L["rowOffsets"])):
                        for i in range(n_row):
                            if len(placements) < max_placements:
                                placements.append([round(float(L["origin"][0] + off + i * px + k * sx), 2),
                                                   round(float(L["origin"][1] + j * py + k * sy), 2),
                                                   round(float(k * pz), 2)])
            methods.append({
                "id": mid, "name": name, "count": int(best["count"]),
                "layers": best["layout"]["layers"] if best["layout"] else 0,
                "perLayer": sum(best["layout"]["rows"]) if best["layout"] else 0,
                "usedH": round(float(best["usedH"]), 2), "computeMs": round(ms),
                "pitch": [round(float(best["vec"][0][0]), 2), round(float(best["vec"][1][1]), 2), round(float(best["vec"][2][2]), 2)],
                "shift": [round(float(best["vec"][2][0]), 2), round(float(best["vec"][2][1]), 2)],
                "rowShift": round(float(best["vec"][1][0]), 2),
                "nested": bool(best["vec"][2][2] < best["ext"][2] - 1e-6 or best["vec"][0][0] < best["ext"][0] - 1e-6 or best["vec"][1][1] < best["ext"][1] - 1e-6),
                "matrix": [round(float(x), 6) for x in best["T"].flatten()],  # 4×4 row-major, part → carton (mm, Z up)
                "placements": placements
            })
        out.append({"id": c["id"], "methods": methods})
    result = {"voxelMm": round(float(h), 3), "timedOut": timed_out, "computeMs": round((time.monotonic() - t0) * 1000), "cartons": out}

    # Phase 5: clusters (pairs and pairs of pairs, turned 180°), with the remaining time budget
    if clusters and time.monotonic() < deadline:
        from cluster import cluster_pack  # local import: cluster.py imports this module
        hc = float(max(mesh.extents)) / cluster_resolution
        rots = rotations(upright)
        picks = [rots[0]] if upright else [rots[0], rots[2], rots[4]]  # each axis up once; Z turns via the carton swap
        models = []
        for R in picks:
            G, T, _, origin = voxel_model(mesh, R, hc, return_origin=True)
            models.append((G, T, hc, origin))
        cp = cluster_pack(mesh, models, cartons, upright, max(1.0, deadline - time.monotonic()), max_placements)
        for c_out, c_cl in zip(out, cp["cartons"]):
            c_out["methods"].extend(c_cl["methods"])
        result["clusters"] = cp["clusters"]
        result["clustersConsidered"] = cp["considered"]
        result["clusterVoxelMm"] = round(hc, 3)
        result["computeMs"] = round((time.monotonic() - t0) * 1000)
    return result
