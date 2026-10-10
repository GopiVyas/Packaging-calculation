import { floorRects } from './floorRects.js';

// Turn engine results into boxes for <Viewer3D>. All sizes in mm.
// Viewer axes: x = length, y = height (up), z = width.

const PART = '#7B5BD6';
const CARTON = '#C9A46A';
const LOAD = '#3F7FD1';
const DECK = '#5E5E5E';
const MAX_PARTS = 600; // keep the browser fast on very full cartons

/** Section 4: parts inside one carton. baseline = before the height trim. */
export function cartonScene(c, { baseline = false, cad = false } = {}) {
  const wall = c.wallMm || 0;
  const inner = baseline ? c.originalInner : c.inner;
  const outer = baseline ? c.baselineOuter : c.outer;
  const [a, b, h] = c.orient;
  const boxes = [
    { pos: [0, 0, 0], size: [outer.l, outer.h, outer.w], color: '#9AA3AE', opacity: 0.18, edge: true, layer: 'carton' },
    { pos: [wall, wall, wall], size: [inner.l, inner.h, inner.w], wire: true, color: '#C98A2B', layer: 'inner' }
  ];
  const items = []; // placements for the real CAD part (section 4 with a STEP file)
  let n = 0;
  outer: for (let z = 0; z < c.grid.nz; z++) {
    for (let y = 0; y < c.grid.ny; y++) {
      for (let x = 0; x < c.grid.nx; x++) {
        if (n >= c.perCarton || n >= MAX_PARTS) break outer;
        const pos = [wall + x * a, wall + z * h, wall + y * b];
        if (cad) items.push({ pos, orient: [a, b, h] });
        else boxes.push({ pos, size: [a * 0.96, h * 0.96, b * 0.96], color: PART });
        n++;
      }
    }
  }
  const used = c.grid.usedLayers * h;
  boxes.push({ pos: [wall, wall, wall], size: [c.grid.nx * a, used, c.grid.ny * b], wire: true, color: '#1E6B43', layer: 'envelope' });
  return { boxes, items, dims: { l: outer.l, w: outer.w, h: outer.h }, shown: n };
}

/** Section 5: cartons stacked on the pallet (layers may mix carton directions). */
export function palletScene(c, pallet) {
  const p = c.pallet;
  const rects = floorRects(p.layer);
  const ch = c.outer.h;
  const boxes = [{ pos: [0, 0, 0], size: [pallet.L, pallet.deckH, pallet.W], color: DECK, layer: 'deck' }];
  // Full layers from the bottom; a part layer on top (weight limit) sits as one tidy block in the
  // middle of the pallet, the way it is loaded for stability, not scattered or in a corner.
  const used = rects.length ? Math.ceil(p.perPallet / rects.length) : 0;
  const cx = pallet.L / 2, cz = pallet.W / 2;
  const central = [...rects].sort((a, b) => Math.hypot(a.x + a.l / 2 - cx, a.y + a.w / 2 - cz) - Math.hypot(b.x + b.l / 2 - cx, b.y + b.w / 2 - cz));
  for (let layer = 0; layer < used; layer++) {
    const inLayer = Math.min(rects.length, p.perPallet - layer * rects.length);
    const pick = inLayer >= rects.length ? rects : central.slice(0, inLayer);
    for (const q of pick) {
      boxes.push({ pos: [q.x, pallet.deckH + layer * ch, q.y], size: [q.l, ch, q.w], color: (layer + (q.l !== rects[0].l ? 1 : 0)) % 2 ? LOAD : '#3573C2', edgeColor: '#1C3F70', layer: 'loaded' });
    }
  }
  const usedL = Math.max(0, ...rects.map((q) => q.x + q.l));
  const usedW = Math.max(0, ...rects.map((q) => q.y + q.w));
  const stackH = p.heightMm - pallet.deckH;
  // outline of the whole carton stack (wire, so it never hides the cartons)
  boxes.push({ pos: [0, pallet.deckH, 0], size: [usedL || 1, stackH || 1, usedW || 1], wire: true, color: '#1E6B43', layer: 'stack' });
  boxes.push({ pos: [0, pallet.deckH, 0], size: [pallet.L, pallet.maxStackH - pallet.deckH, pallet.W], wire: true, color: '#C2410C', layer: 'limit' });
  return { boxes, dims: { l: pallet.L, w: pallet.W, h: p.heightMm }, usedL, usedW };
}

/** Section 6: loaded pallets in one container, stacked in tiers (floor may mix pallet directions). */
export function containerScene(c, ct, pallet) {
  const rects = floorRects(ct.floor);
  const ph = c.pallet.heightMm;
  const boxes = [
    { pos: [0, 0, 0], size: [ct.inner.l, ct.inner.h, ct.inner.w], color: '#9AA3AE', opacity: 0.12, layer: 'shell' },
    { pos: [0, 0, 0], size: [ct.inner.l, ct.loadH, ct.inner.w], wire: true, color: '#1E6B43', layer: 'space' }
  ];
  let n = 0;
  for (let t = 0; t < ct.tiers && n < ct.pallets; t++) {
    for (const q of rects) {
      if (n >= ct.pallets) break;
      const y = t * ph;
      boxes.push({ pos: [q.x, y, q.y], size: [q.l, pallet.deckH, q.w], color: DECK, edge: false, layer: 'pallets' });
      boxes.push({ pos: [q.x + 5, y + pallet.deckH, q.y + 5], size: [q.l - 10, ph - pallet.deckH, q.w - 10], color: t ? '#5B95DE' : q.l !== rects[0].l ? '#3573C2' : LOAD, edgeColor: '#1C3F70', layer: 'pallets' });
      n++;
    }
  }
  const onFloor = rects.slice(0, Math.min(ct.pallets, rects.length));
  const stackL = Math.max(0, ...onFloor.map((q) => q.x + q.l));
  const stackW = Math.max(0, ...onFloor.map((q) => q.y + q.w));
  boxes.push({ pos: [0, 0, 0], size: [stackL || 1, ph * ct.tiers, stackW || 1], wire: true, color: '#C2410C', layer: 'stack' });
  return { boxes, dims: { l: ct.inner.l, w: ct.inner.w, h: ct.loadH }, stackL, stackW };
}
