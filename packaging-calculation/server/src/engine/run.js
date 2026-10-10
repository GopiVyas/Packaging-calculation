// One calculation run for one part: every carton × every container, ranked by cost per piece.
// This is the data behind sections 4–7 of the part page.
import { fitPartsInCarton, cartonOuter, fitCartonsOnPallet, fitPalletsInContainer } from './fit.js';
import { round } from './units.js';

export const RUN_DEFAULTS = {
  optimiseHeight: true, // trim carton height to the packed contents
  maxTiers: 2, // pallets stacked in the container (1 = no stacking)
  clearanceMm: 50, // headroom left under the container roof
  qty: 10000 // order quantity, for "containers needed"
};

export const ALGORITHMS = [
  { id: 'grid', name: 'Grid packing (box)', quotable: true },
  // Phase 4: real-shape methods, calculated by the CAD service (cad-service/pack.py) for CAD parts
  { id: 'column', name: 'Column Stacking', quotable: true },
  { id: 'pattern', name: 'Repeating Pattern', quotable: true },
  // Phase 5: clusters of copies turned 180° against each other (cad-service/cluster.py)
  { id: 'cluster', name: 'Cluster Packing', quotable: true },
  { id: 'nested', name: 'Nested Clusters', quotable: true }
];

/**
 * part:       { box:{l,w,h}, weightKg, upright, volumeMm3? }
 * cartons:    saved cartons (mm/kg/price)
 * pallet:     saved pallet
 * containers: saved containers (with freightCost)
 * realShape:  optional result of the CAD service /pack (Phase 4): per carton, Column Stacking and
 *             Repeating Pattern counts + layouts. The best quotable count (grid or real shape) is used.
 */
export function runPart({ part, cartons, pallet, containers, settings = {}, realShape = null, onProgress = () => {} }) {
  const s = { ...RUN_DEFAULTS, ...settings };
  const t0 = Date.now();
  const partVol = part.volumeMm3 || part.box.l * part.box.w * part.box.h;

  const results = [];
  const skipped = []; // cartons the part does not fit in, with the reason
  for (const [ci, carton] of cartons.entries()) {
    onProgress({ pct: Math.round((ci / cartons.length) * 100), step: `Packing ${carton.name} (${ci + 1} of ${cartons.length})` });
    const t1 = Date.now();
    const fit = fitPartsInCarton(part.box, part.weightKg, part.upright, carton);
    if (fit.perCarton < 1) {
      // say why, so the user can fix the carton in Master data
      const pb = part.box;
      const dims = (x, y, z) => `${Math.round(x)} × ${Math.round(y)} × ${Math.round(z)} mm`;
      skipped.push({
        id: String(carton._id ?? carton.name), name: carton.name,
        reason: fit.spaceCount < 1
          ? `inside ${dims(carton.innerL, carton.innerW, carton.innerH)} is too small for the part (${dims(pb.l, pb.w, pb.h)}) in every position${part.upright ? ' it may take upright' : ''}`
          : `max. weight ${carton.maxWeightKg || 0} kg is less than one part (${Math.round(part.weightKg * 1000) / 1000} kg)`
      });
      continue;
    }
    const cid = String(carton._id ?? carton.name);
    const byWeight = part.weightKg > 0 ? Math.floor(carton.maxWeightKg / part.weightKg + 1e-9) : Infinity;

    // All packing algorithms for this carton; the best quotable count wins (ties: the simple grid).
    const perLayerInCarton = fit.grid.nx * fit.grid.ny;
    const gridLayers = Math.ceil(fit.perCarton / perLayerInCarton);
    const algorithms = [{ id: 'grid', name: 'Grid packing (box)', quotable: true, count: fit.perCarton, rawCount: fit.spaceCount, computeMs: 0, usedH: gridLayers * fit.orient[2] }];
    const rs = realShape?.cartons?.find((x) => x.id === cid);
    const arrangements = {};
    for (const m of rs?.methods || []) {
      const count = Math.min(m.count, byWeight);
      // Fewer copies than the full layout (weight limit): only the layers actually needed.
      const layersNeeded = m.perLayer ? Math.ceil(count / m.perLayer) : m.layers;
      const usedH = m.usedH - Math.max(0, m.layers - layersNeeded) * m.pitch[2];
      algorithms.push({ id: m.id, name: m.name, quotable: true, count, rawCount: m.count, computeMs: m.computeMs, nested: !!m.nested, usedH });
      arrangements[m.id] = m.copies
        // clusters: one exact 3×4 matrix per piece (part → carton)
        ? { copies: m.copies.slice(0, count), layers: layersNeeded, perLayer: m.perLayer, pitch: m.pitch, nested: !!m.nested, clusterIndex: m.clusterIndex, piecesPerCluster: m.piecesPerCluster, mixed: !!m.mixed, singles: m.singles || 0 }
        : { matrix: m.matrix, placements: m.placements.slice(0, count), layers: layersNeeded, perLayer: m.perLayer, pitch: m.pitch, shift: m.shift, rowShift: m.rowShift, nested: !!m.nested };
    }
    const bestAlgo = algorithms.reduce((a, b) => (b.count > a.count ? b : a));
    algorithms.forEach((a) => { a.best = a === bestAlgo; });
    const perCarton = bestAlgo.count;

    // Carton height optimisation: cut the carton to the height the packed parts actually use.
    const neededH = Math.ceil(bestAlgo.usedH - 1e-6);
    const trimmed = s.optimiseHeight && neededH < carton.innerH;
    const inner = { l: carton.innerL, w: carton.innerW, h: trimmed ? neededH : carton.innerH };
    const baselineOuter = cartonOuter(carton);
    const outer = cartonOuter({ ...carton, innerH: inner.h });
    const grossKg = perCarton * part.weightKg + (carton.emptyWeightKg || 0);

    const pal = fitCartonsOnPallet(outer, grossKg, pallet);
    if (pal.perPallet < 1) continue;
    const piecesPerPallet = pal.perPallet * perCarton;
    const loadKg = pal.perPallet * grossKg; // cartons only; the pallet's own weight comes on top

    const perContainer = containers.map((ct) => {
      const con = fitPalletsInContainer(pallet.L, pallet.W, pal.heightMm, pal.palletKg, ct, { maxTiers: s.maxTiers, clearanceMm: s.clearanceMm });
      const pieces = con.perContainer * piecesPerPallet;
      const freightPerPiece = pieces ? (ct.freightCost || 0) / pieces : null;
      return {
        id: String(ct._id ?? ct.name),
        name: ct.name,
        inner: { l: ct.innerL, w: ct.innerW, h: ct.innerH },
        loadH: con.loadH,
        floor: con.floor,
        perFloorLayer: con.floor.count,
        tiers: con.tiers,
        slots: con.slots,
        pallets: con.perContainer,
        pieces,
        kg: round(con.perContainer * pal.palletKg, 1),
        payloadKg: ct.payloadKg,
        limitedBy: con.perContainer === 0 ? 'height' : con.perContainer < con.slots ? 'weight'
          : con.tiers < Math.floor((con.loadH + 1e-6) / pal.heightMm) ? 'stacking' : 'volume',
        tiersRoomFor: pal.heightMm > 0 ? Math.floor((con.loadH + 1e-6) / pal.heightMm) : 0,
        freightCost: ct.freightCost || 0,
        costPerPiece: pieces ? round((carton.price || 0) / perCarton + freightPerPiece, 4) : null,
        containersNeeded: pieces ? Math.ceil(s.qty / pieces) : null
      };
    });
    const usable = perContainer.filter((c) => c.pieces > 0);
    const best = usable.sort((a, b) => a.costPerPiece - b.costPerPiece || b.pieces - a.pieces)[0] || null;
    perContainer.forEach((c) => { c.recommended = !!best && c.id === best.id; });

    results.push({
      id: String(carton._id ?? carton.name),
      name: carton.name,
      isSuggested: !!carton.isSuggested,
      price: carton.price || 0,
      wallMm: carton.wallMm || 0,
      originalInner: { l: carton.innerL, w: carton.innerW, h: carton.innerH },
      inner,
      outer,
      baselineOuter,
      trimmed,
      perCarton,
      grid: { ...fit.grid, usedLayers: gridLayers },
      orient: fit.orient,
      method: bestAlgo.id,
      arrangements,
      cartonLimitedBy: byWeight < bestAlgo.rawCount ? 'weight' : 'space',
      grossKg: round(grossKg, 2),
      fill: round((perCarton * partVol * 100) / (inner.l * inner.w * inner.h), 1),
      binding: byWeight < bestAlgo.rawCount ? 'Weight' : 'Geometry',
      pallet: {
        perLayer: pal.perLayer, layers: Math.ceil(pal.perPallet / pal.perLayer), maxLayers: pal.layers, perPallet: pal.perPallet,
        layer: pal.layer, palletKg: round(pal.palletKg, 2), loadKg: round(loadKg, 2), heightMm: pal.heightMm, stackH: pal.heightMm - pallet.deckH,
        limitedBy: pal.limitedBy, fill: round(pal.fill * 100, 1)
      },
      piecesPerPallet,
      containers: perContainer.sort((a, b) => (a.costPerPiece ?? Infinity) - (b.costPerPiece ?? Infinity)),
      bestContainerId: best?.id ?? null,
      costPerPiece: best?.costPerPiece ?? null,
      algorithms: algorithms.map((a) => (a.id === 'grid' ? { ...a, computeMs: Date.now() - t1 } : a))
    });
  }

  onProgress({ pct: 100, step: 'Ranking cartons and containers' });
  results.sort((a, b) => (a.costPerPiece ?? Infinity) - (b.costPerPiece ?? Infinity) || b.piecesPerPallet - a.piecesPerPallet);
  return {
    settings: s,
    pallet: { name: pallet.name, L: pallet.L, W: pallet.W, deckH: pallet.deckH, maxStackH: pallet.maxStackH, maxLoadKg: pallet.maxLoadKg, weightKg: pallet.weightKg },
    part: { name: part.name, box: part.box, weightKg: part.weightKg, upright: !!part.upright, shape: part.shape },
    cartons: results,
    skipped,
    winner: results[0] ? { cartonId: results[0].id, containerId: results[0].bestContainerId } : null,
    realShape: realShape ? { voxelMm: realShape.voxelMm, computeMs: realShape.computeMs, timedOut: !!realShape.timedOut, clusterVoxelMm: realShape.clusterVoxelMm ?? null } : null,
    // Phase 5: every cluster the engine considered (best first) for section 3
    clusters: realShape?.clusters || null,
    clustersConsidered: realShape?.clustersConsidered ?? 0,
    realShapeError: settings.realShapeError || null,
    durationMs: Date.now() - t0
  };
}
