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

/** Section 5: cartons stacked on the pallet. */
export function palletScene(c, pallet) {
  const p = c.pallet;
  const { cols, rows, itemL, itemW } = p.layer;
  const ch = c.outer.h;
  const boxes = [{ pos: [0, 0, 0], size: [pallet.L, pallet.deckH, pallet.W], color: DECK }];
  let n = 0;
  for (let layer = 0; layer < p.layers; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        if (n >= p.perPallet) break;
        boxes.push({ pos: [k * itemL, pallet.deckH + layer * ch, r * itemW], size: [itemL, ch, itemW], color: n % 2 ? LOAD : '#3573C2', edgeColor: '#1C3F70', layer: 'loaded' });
        n++;
      }
    }
  }
  const stackH = p.layers * ch;
  boxes.push({ pos: [0, pallet.deckH, 0], size: [cols * itemL, stackH, rows * itemW], color: CARTON, opacity: 0.85, layer: 'stack' });
  boxes.push({ pos: [0, pallet.deckH, 0], size: [pallet.L, pallet.maxStackH - pallet.deckH, pallet.W], wire: true, color: '#C2410C', layer: 'limit' });
  return { boxes, dims: { l: pallet.L, w: pallet.W, h: p.heightMm } };
}

/** Section 6: loaded pallets in one container, stacked in tiers. */
export function containerScene(c, ct, pallet) {
  const { cols, rows, itemL, itemW } = ct.floor;
  const ph = c.pallet.heightMm;
  const boxes = [
    { pos: [0, 0, 0], size: [ct.inner.l, ct.inner.h, ct.inner.w], color: '#9AA3AE', opacity: 0.12, layer: 'shell' },
    { pos: [0, 0, 0], size: [ct.inner.l, ct.loadH, ct.inner.w], wire: true, color: '#1E6B43', layer: 'space' }
  ];
  let n = 0;
  for (let t = 0; t < ct.tiers; t++) {
    for (let k = 0; k < cols; k++) {
      for (let r = 0; r < rows; r++) {
        if (n >= ct.pallets) break;
        const y = t * ph;
        boxes.push({ pos: [k * itemL, y, r * itemW], size: [itemL, pallet.deckH, itemW], color: DECK, edge: false });
        boxes.push({ pos: [k * itemL + 5, y + pallet.deckH, r * itemW + 5], size: [itemL - 10, ph - pallet.deckH, itemW - 10], color: t ? '#5B95DE' : LOAD, edgeColor: '#1C3F70' });
        n++;
      }
    }
  }
  const stackL = Math.ceil(Math.min(ct.pallets, cols * rows) / rows) * itemL;
  boxes.push({ pos: [0, 0, 0], size: [stackL || 1, ph * ct.tiers, rows * itemW], wire: true, color: '#C2410C', layer: 'stack' });
  return { boxes, dims: { l: ct.inner.l, w: ct.inner.w, h: ct.loadH } };
}
