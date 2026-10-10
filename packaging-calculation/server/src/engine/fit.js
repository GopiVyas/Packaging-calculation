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

/** Floor pattern for boxes of l×w on an L×W area: same direction, best of the two turns. */
export function floorPattern(L, W, l, w) {
  const a = { cols: f(L / l), rows: f(W / w), rotated: false };
  const b = { cols: f(L / w), rows: f(W / l), rotated: true };
  const pa = a.cols * a.rows;
  const pb = b.cols * b.rows;
  const p = pb > pa ? b : a;
  return { ...p, count: Math.max(pa, pb), itemL: p.rotated ? w : l, itemW: p.rotated ? l : w };
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
