"""
Clusters (Phase 5): copies of the part turned 180° against each other and slid together until
they interlock (T-shapes head to toe, L-brackets in pairs, …). A cluster is then packed as one unit:

  Cluster Packing  — clusters side by side at their exact size (grid)
  Nested Clusters  — clusters that also nest into each other (lattice, as in pack.py)

All work happens on the conservative voxel model, so pieces never overlap. A 180° turn of the voxel
grid (flipping two axes) is an exact rotation of the cells, and every piece keeps an exact 4×4
matrix (part → carton, mm) so the real geometry can be drawn and checked.
"""
import itertools
import time

import numpy as np

from pack import collide, count_in, solve_lattice

FLIPS = {"180° Z": (0, 1), "180° X": (1, 2), "180° Y": (0, 2)}


class Unit:
    """A rigid group of pieces on a voxel grid. origin = mm position of the lower corner of voxel (0,0,0)."""

    def __init__(self, grid, origin, h, pieces, label, hull):
        self.grid, self.origin, self.h = grid, np.asarray(origin, float), h
        self.pieces = pieces  # list of 4×4: part mesh → unit frame (mm)
        self.label, self.hull = label, hull

    @property
    def n(self):
        return len(self.pieces)

    def bounds(self):
        pts = [(P[:3, :3] @ self.hull.T).T + P[:3, 3] for P in self.pieces]
        allp = np.vstack(pts)
        return allp.min(0), allp.max(0)


def unit_from_grid(G, T, h, origin, hull):
    return Unit(G, origin, h, [T.copy()], "single", hull)


def flip_unit(u, axes):
    """The unit turned 180° about the axis normal to `axes`, in the same grid frame."""
    Gf = np.flip(u.grid, axis=axes)
    M = np.eye(4)
    for a in axes:
        M[a, a] = -1.0
        M[a, 3] = 2 * u.origin[a] + u.grid.shape[a] * u.h  # cell i ↔ cell n-1-i exactly
    return Gf, [M @ P for P in u.pieces]


def approach_offsets(A, B, search, step):
    """Offsets d (voxels) placing B right against A, approaching along each axis from both sides,
    for every sideways offset within `search` (step `step`). Profiles are conservative, so no overlap."""
    out = []
    for ax in range(3):
        o1, o2 = [a for a in range(3) if a != ax]
        At, Bt = np.moveaxis(A, ax, 2), np.moveaxis(B, ax, 2)
        na, nb = At.shape, Bt.shape
        occ_a, occ_b = At.any(2), Bt.any(2)
        topA = np.where(occ_a, na[2] - np.argmax(At[:, :, ::-1], 2), -10**6)
        botA = np.where(occ_a, np.argmax(At, 2), 10**6)
        topB = np.where(occ_b, nb[2] - np.argmax(Bt[:, :, ::-1], 2), -10**6)
        botB = np.where(occ_b, np.argmax(Bt, 2), 10**6)
        for s1 in range(-search, search + 1, step):
            for s2 in range(-search, search + 1, step):
                # overlap window of A columns (i, j) with B columns (i - s1, j - s2)
                ia0, ia1 = max(0, s1), min(na[0], nb[0] + s1)
                ja0, ja1 = max(0, s2), min(na[1], nb[1] + s2)
                if ia0 >= ia1 or ja0 >= ja1:
                    continue
                ib0, jb0 = ia0 - s1, ja0 - s2
                sa = (slice(ia0, ia1), slice(ja0, ja1))
                sb = (slice(ib0, ib0 + ia1 - ia0), slice(jb0, jb0 + ja1 - ja0))
                both = (occ_a[sa]) & (occ_b[sb])
                if not both.any():
                    continue
                up = int(np.max(topA[sa][both] - botB[sb][both]))  # B above A
                down = -int(np.max(topB[sb][both] - botA[sa][both]))  # B below A
                for dz in (up, down):
                    d = [0, 0, 0]
                    d[o1], d[o2], d[ax] = s1, s2, dz
                    out.append(tuple(d))
    return out


def union(A, B, d):
    lo = np.minimum(0, d)
    hi = np.maximum(A.shape, np.array(B.shape) + d)
    U = np.zeros(tuple(hi - lo), dtype=bool)
    a0 = -lo
    b0 = np.array(d) - lo
    U[a0[0]:a0[0] + A.shape[0], a0[1]:a0[1] + A.shape[1], a0[2]:a0[2] + A.shape[2]] |= A
    U[b0[0]:b0[0] + B.shape[0], b0[1]:b0[1] + B.shape[1], b0[2]:b0[2] + B.shape[2]] |= B
    return U, lo


def best_pairs(u, deadline, keep=3, search_frac=0.5, upright=False):
    """Best ways to join a unit with a 180°-turned copy of itself (smallest exact bounding box)."""
    cands = []
    flips = {"180° Z": FLIPS["180° Z"]} if upright else FLIPS
    for label, axes in flips.items():
        if time.monotonic() > deadline:
            break
        Gf, piecesB = flip_unit(u, axes)
        search = max(1, int(max(u.grid.shape) * search_frac))
        step = max(1, search // 16)
        offs = approach_offsets(u.grid, Gf, search, step)
        scored = []
        for d in set(offs):
            d = np.array(d)
            lo = np.minimum(0, d)
            hi = np.maximum(u.grid.shape, np.array(Gf.shape) + d)
            scored.append((float(np.prod(hi - lo)), tuple(d)))
        scored.sort()
        for vol, d in scored[:8]:
            if collide(u.grid, Gf, d):  # profiles are conservative, but check anyway
                continue
            U, lo = union(u.grid, Gf, np.array(d))
            shift = np.eye(4)
            shift[:3, 3] = np.array(d) * u.h
            pieces = u.pieces + [shift @ P for P in piecesB]
            new = Unit(U, u.origin + lo * u.h, u.h, pieces, f"{u.label} + {label}" if u.n > 1 else label, u.hull)
            cands.append(new)
            break
    return cands


def normalize(u):
    """Move the unit so the exact geometry's min corner is at 0. Returns (pieces, ext)."""
    lo, hi = u.bounds()
    S = np.eye(4)
    S[:3, 3] = -lo
    return [S @ P for P in u.pieces], hi - lo


def build_clusters(mesh_hull, G, T, h, origin, deadline, upright=False, part_box=None, part_vol=None):
    """Singles, pairs and pairs of pairs. Returns a list of cluster dicts, best (densest) first."""
    single = unit_from_grid(G, T, h, origin, mesh_hull)
    units = []
    for p in best_pairs(single, deadline, upright=upright):
        units.append(p)
        if time.monotonic() < deadline:
            units.extend(best_pairs(p, deadline, keep=1, upright=upright)[:2])
    out = []
    box_vol = float(np.prod(part_box))
    for u in units:
        pieces, ext = normalize(u)
        cvol = float(np.prod(ext))
        out.append({
            "unit": u, "pieces": pieces, "ext": ext, "pcs": u.n, "label": u.label,
            "fill": (u.n * part_vol / cvol) if part_vol else None,
            "vsLoose": u.n * box_vol / cvol,  # > 1: the cluster is denser than loose parts
        })
    out.sort(key=lambda c: -c["vsLoose"])
    return out


def pack_cluster(cl, inner, method, deadline):
    """Count clusters of one kind in a carton (both turns about Z). Returns dict or None."""
    u = cl["unit"]
    ext = cl["ext"]
    vecs = [[(ext[0], 0, 0), (0, ext[1], 0), (0, 0, ext[2])]]  # clusters side by side at their exact size
    if method == "nested":  # …or nesting into each other; the grid stays a candidate, so never worse
        if "lattice" not in cl:
            cl["lattice"] = solve_lattice(u.grid, "pattern", deadline)
        if cl["lattice"] is not None:
            vecs.append([tuple(float(c) * u.h for c in x) for x in cl["lattice"]])
    best = None
    for vec in vecs:
        for swap in (False, True):
            box = (inner[1], inner[0], inner[2]) if swap else inner
            n, layout, used_h = count_in(box, ext, vec)
            if n and (best is None or n > best["clusters"]):
                best = {"clusters": n, "layout": layout, "usedH": used_h, "swap": swap, "vec": vec}
    return best


def copies_of(cl, packed, inner, max_copies):
    """Exact 4×4 (part → carton, mm, Z up) for every piece of every placed cluster."""
    (px, _, _), (ox, py, _), (sx, sy, pz) = packed["vec"]
    L = packed["layout"]
    Q = np.eye(4)
    if packed["swap"]:  # arrangement was made in a carton turned 90°: turn it back
        Q = np.array([[0, 1, 0, 0], [-1, 0, 0, inner[1]], [0, 0, 1, 0], [0, 0, 0, 1]], dtype=float)
    out = []
    for k in range(L["layers"]):
        for j, (n_row, off) in enumerate(zip(L["rows"], L["rowOffsets"])):
            for i in range(n_row):
                t = np.eye(4)
                t[:3, 3] = [L["origin"][0] + off + i * px + k * sx, L["origin"][1] + j * py + k * sy, k * pz]
                for P in cl["pieces"]:
                    if len(out) >= max_copies:
                        return out
                    out.append(Q @ t @ P)
    return out


def cluster_pack(mesh, voxel_models, cartons, upright, budget_s, max_copies=1500):
    """
    voxel_models: [(G, T, h, origin)] for the part orientations to build clusters from.
    Returns {clusters: [...], cartons: [{id, methods: [cluster, nested]}]}.
    """
    t0 = time.monotonic()
    deadline = t0 + budget_s
    hull = mesh.convex_hull.vertices if len(mesh.vertices) > 64 else mesh.vertices
    part_vol = float(mesh.volume) if mesh.is_watertight else None
    clusters = []
    for G, T, h, origin in voxel_models:
        if time.monotonic() > deadline:
            break
        clusters += build_clusters(hull, G, T, h, origin, deadline, upright, mesh.extents, part_vol)
    clusters.sort(key=lambda c: -c["vsLoose"])
    top = clusters[:4]
    build_ms = (time.monotonic() - t0) * 1000

    out_cartons = []
    for c in cartons:
        inner = (c["innerL"], c["innerW"], c["innerH"])
        methods = []
        for mid, name in (("cluster", "Cluster Packing"), ("nested", "Nested Clusters")):
            t1 = time.monotonic()
            best, best_cl = None, None
            for cl in top:
                if time.monotonic() > deadline and best is not None:
                    break
                r = pack_cluster(cl, inner, mid, deadline)
                if r and (best is None or r["clusters"] * cl["pcs"] > best["clusters"] * best_cl["pcs"]):
                    best, best_cl = r, cl
            if best is None:
                methods.append({"id": mid, "name": name, "count": 0, "copies": [], "computeMs": round((time.monotonic() - t1) * 1000)})
                continue
            copies = copies_of(best_cl, best, inner, max_copies)
            (px, _, _), (ox, py, _), (sx, sy, pz) = best["vec"]
            methods.append({
                "id": mid, "name": name, "count": int(best["clusters"] * best_cl["pcs"]),
                "clusterIndex": clusters.index(best_cl), "piecesPerCluster": best_cl["pcs"],
                "layers": best["layout"]["layers"], "perLayer": sum(best["layout"]["rows"]) * best_cl["pcs"],
                "usedH": round(float(best["usedH"]), 2), "pitch": [round(float(px), 2), round(float(py), 2), round(float(pz), 2)],
                "nested": bool(mid == "nested" and (pz < best_cl["ext"][2] - 1e-6 or px < best_cl["ext"][0] - 1e-6)),
                "computeMs": round((time.monotonic() - t1) * 1000 + build_ms / 2),
                "copies": [[round(float(x), 5) for x in M[:3].flatten()] for M in copies]  # 3×4 row-major each
            })
        out_cartons.append({"id": c["id"], "methods": methods})

    listing = []
    for i, cl in enumerate(clusters[:40]):
        listing.append({
            "index": i, "label": cl["label"], "pcs": cl["pcs"],
            "size": [round(float(x), 1) for x in cl["ext"]],
            "fill": round(cl["fill"] * 100, 1) if cl["fill"] else None,
            "vsLoose": round(cl["vsLoose"] * 100, 1),
            "pieces": [[round(float(x), 5) for x in P[:3].flatten()] for P in cl["pieces"]] if i < 12 else None
        })
    return {"clusters": listing, "considered": len(clusters), "computeMs": round((time.monotonic() - t0) * 1000), "cartons": out_cartons}
