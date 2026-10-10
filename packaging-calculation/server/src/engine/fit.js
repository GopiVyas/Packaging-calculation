// The three fitting steps: parts → carton, cartons → pallet, pallets → container.
// Pure functions, mm and kg only. Each returns the numbers AND the layout the pictures are drawn from.

const f = Math.floor;

/** All ways to place a box. Upright parts may only turn around the vertical axis. */
export function orientations({ l, w, h }, upright = false) {
  const list = upright
    ? [[l, w, h], [w, l, h]]
    : [[l, w, h], [l, h, w], [w, l, h], [w, h, l], [h, l, w], [h, w, l]];
  const seen = new Set();
  return list.filter((o) => {
    const k = o.join('x');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * How many parts fit in a carton.
 * carton: { innerL, innerW, innerH, maxWeightKg }
 */
export function fitPartsInCarton(partBox, partWeightKg, upright, carton) {
  let best = { spaceCount: 0, grid: { nx: 0, ny: 0, nz: 0 }, orient: null };
  for (const [a, b, c] of orientations(partBox, upright)) {
    const nx = f(carton.innerL / a);
    const ny = f(carton.innerW / b);
    const nz = f(carton.innerH / c);
    const count = nx * ny * nz;
    // Prefer more parts; on a tie prefer fewer layers (more stable).
    if (count > best.spaceCount || (count === best.spaceCount && count > 0 && nz < best.grid.nz)) {
      best = { spaceCount: count, grid: { nx, ny, nz }, orient: [a, b, c] };
    }
  }
  const byWeight = partWeightKg > 0 ? f(carton.maxWeightKg / partWeightKg + 1e-9) : Infinity;
  const perCarton = Math.min(best.spaceCount, byWeight);
  return {
    perCarton,
    grid: best.grid,
    orient: best.orient,
    spaceCount: best.spaceCount,
    limitedBy: perCarton < best.spaceCount ? 'weight' : 'space'
  };
}

export function cartonOuter(carton) {
  const t = 2 * (carton.wallMm || 0);
  return { l: carton.innerL + t, w: carton.innerW + t, h: carton.innerH + t };
}

/** Lengths reachable as a·l + b·w (≤ L): the only places a guillotine cut needs to be tried. */
function cutPositions(L, l, w) {
  const out = new Set();
  for (let a = 0; a * l <= L + 1e-9; a++) {
    for (let b = 0; a * l + b * w <= L + 1e-9; b++) {
      const x = a * l + b * w;
      if (x > 0 && x < L - 1e-9) out.add(Math.round(x * 1000) / 1000);
    }
  }
  return [...out];
}

/**
 * Floor pattern for boxes of l×w on an L×W area. Boxes may be turned 90° on the floor and the
 * pattern may mix both directions in blocks (guillotine cuts, up to `depth` levels), e.g. Euro
 * pallets in a 40 ft container: one row lengthwise + one row crosswise = 25 instead of 20.
 * Returns the count, every box position (rects: x, y, l, w) and, for older callers, the main
 * block as cols × rows.
 */
export function floorPattern(L, W, l, w, depth = 3) {
  const memo = new Map();
  const single = (A, B) => {
    const a = f(A / l + 1e-9) * f(B / w + 1e-9);
    const b = f(A / w + 1e-9) * f(B / l + 1e-9);
    return b > a ? { n: b, kind: 'grid', il: w, iw: l } : { n: a, kind: 'grid', il: l, iw: w };
  };
  const best = (A, B, d) => {
    const key = `${A}|${B}|${d}`;
    if (memo.has(key)) return memo.get(key);
    let r = single(A, B);
    if (d > 0) {
      for (const x of cutPositions(A, l, w)) { // cut across the length
        const n = best(x, B, d - 1).n + best(A - x, B, d - 1).n;
        if (n > r.n) r = { n, kind: 'x', at: x };
      }
      for (const y of cutPositions(B, l, w)) { // cut across the width
        const n = best(A, y, d - 1).n + best(A, B - y, d - 1).n;
        if (n > r.n) r = { n, kind: 'y', at: y };
      }
    }
    memo.set(key, r);
    return r;
  };
  const rects = [];
  const place = (x0, y0, A, B, d) => {
    const r = best(A, B, d);
    if (!r.n) return;
    if (r.kind === 'grid') {
      for (let i = 0; i < f(A / r.il + 1e-9); i++) {
        for (let j = 0; j < f(B / r.iw + 1e-9); j++) rects.push({ x: x0 + i * r.il, y: y0 + j * r.iw, l: r.il, w: r.iw });
      }
    } else if (r.kind === 'x') {
      place(x0, y0, r.at, B, d - 1);
      place(x0 + r.at, y0, A - r.at, B, d - 1);
    } else {
      place(x0, y0, A, r.at, d - 1);
      place(x0, y0 + r.at, A, B - r.at, d - 1);
    }
  };
  place(0, 0, L, W, depth);
  // load order: from the front wall backwards, then across
  rects.sort((p, q) => p.x - q.x || p.y - q.y);
  const g = single(L, W);
  const rotated = g.il !== l;
  return {
    count: rects.length,
    rects,
    mixed: rects.some((r) => r.l !== rects[0].l),
    usedL: rects.reduce((m, r) => Math.max(m, r.x + r.l), 0),
    usedW: rects.reduce((m, r) => Math.max(m, r.y + r.w), 0),
    cols: f(L / g.il + 1e-9), rows: f(W / g.iw + 1e-9), rotated, itemL: g.il, itemW: g.iw
  };
}

/**
 * How many cartons fit on a pallet. Cartons stay "this side up" (they only turn on the floor).
 * pallet: { L, W, deckH, maxStackH, maxLoadKg, weightKg }
 */
export function fitCartonsOnPallet(outer, cartonGrossKg, pallet) {
  const layer = floorPattern(pallet.L, pallet.W, outer.l, outer.w);
  const usableH = pallet.maxStackH - pallet.deckH;
  const layers = usableH > 0 ? f(usableH / outer.h) : 0;
  const spaceCount = layer.count * layers;
  const byWeight = cartonGrossKg > 0 ? f(pallet.maxLoadKg / cartonGrossKg + 1e-9) : Infinity;
  const perPallet = Math.min(spaceCount, byWeight);
  const usedLayers = layer.count ? Math.ceil(perPallet / layer.count) : 0;
  return {
    perLayer: layer.count,
    layers,
    perPallet,
    layer, // { cols, rows, rotated, itemL, itemW } for the pallet picture
    limitedBy: perPallet < spaceCount ? 'weight' : 'space',
    palletKg: perPallet * cartonGrossKg + (pallet.weightKg || 0),
    heightMm: pallet.deckH + usedLayers * outer.h,
    fill: usableH > 0 ? (perPallet * outer.l * outer.w * outer.h) / (pallet.L * pallet.W * usableH) : 0
  };
}

/**
 * How many pallets fit in a container (one tier: no pallets on pallets in this version).
 * container: { innerL, innerW, innerH, payloadKg }
 */
export function fitPalletsInContainer(palletL, palletW, palletHeightMm, palletKg, container, { maxTiers = 1, clearanceMm = 0 } = {}) {
  const floor = floorPattern(container.innerL, container.innerW, palletL, palletW);
  const loadH = container.innerH - clearanceMm;
  // Pallets on pallets: as many tiers as fit under the roof (minus clearance), up to maxTiers.
  const tiers = palletHeightMm > 0 ? Math.min(maxTiers, f(loadH / palletHeightMm)) : 0;
  const slots = floor.count * tiers;
  const byWeight = palletKg > 0 ? f(container.payloadKg / palletKg + 1e-9) : Infinity;
  const perContainer = Math.min(slots, byWeight);
  return {
    slots,
    tiers,
    loadH,
    perContainer,
    floor, // { cols (along length), rows (across width), rotated, itemL, itemW } for the container picture
    limitedBy: slots === 0 ? 'height' : perContainer < slots ? 'weight' : 'space'
  };
}
