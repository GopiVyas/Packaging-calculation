// Hand-checked Phase 1 cases: carton height trim, pallets stacked 2 high, cost per piece.
import { describe, it, expect } from 'vitest';
import { runPart } from '../index.js';

const hub = { name: 'Wheel hub', box: { l: 220, w: 220, h: 120 }, weightKg: 2.4, upright: true };
const S1 = { _id: 'S1', name: 'S1', innerL: 445, innerW: 445, innerH: 245, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.8, price: 78 };
const lowPallet = { name: 'Low', L: 1200, W: 1000, deckH: 150, maxStackH: 1000, maxLoadKg: 1000, weightKg: 25 };
const c20 = { _id: 'c20', name: '20 ft', innerL: 5898, innerW: 2352, innerH: 2393, payloadKg: 28200, freightCost: 120000 };
const c40 = { _id: 'c40', name: '40 ft', innerL: 12032, innerW: 2352, innerH: 2393, payloadKg: 26700, freightCost: 180000 };

describe('runPart', () => {
  const r = runPart({ part: hub, cartons: [S1], pallet: lowPallet, containers: [c20, c40] });
  const c = r.cartons[0];

  it('trims the carton to the packed height: 2 layers × 120 = 240 inside, 250 outside', () => {
    expect(c.trimmed).toBe(true);
    expect(c.inner.h).toBe(240);
    expect(c.outer.h).toBe(250);
    expect(c.baselineOuter.h).toBe(255);
  });
  it('pallet: 4 per layer × 3 layers (850 mm headroom / 250) = 12 cartons, 96 hubs, 900 mm high', () => {
    expect(c.pallet).toMatchObject({ perLayer: 4, layers: 3, perPallet: 12, heightMm: 900 });
    expect(c.piecesPerPallet).toBe(96);
  });
  it('stacks pallets 2 high under 2393 − 50 mm: 20 ft = 9 × 2 = 18 pallets, 1,728 pieces', () => {
    const k = c.containers.find((x) => x.id === 'c20');
    expect(k).toMatchObject({ perFloorLayer: 9, tiers: 2, pallets: 18, pieces: 1728, limitedBy: 'volume' });
  });
  it('40 ft = 22 × 2 = 44 pallets; recommends the lower cost per piece', () => {
    const k40 = c.containers.find((x) => x.id === 'c40');
    expect(k40).toMatchObject({ perFloorLayer: 22, pallets: 44, pieces: 4224 });
    // per piece: carton 78/8 = 9.75 + freight 180000/4224 = 42.6136 → 52.3636 ; 20 ft: 9.75 + 120000/1728 = 79.1944
    expect(k40.costPerPiece).toBeCloseTo(52.3636, 3);
    expect(c.bestContainerId).toBe('c40');
  });
  it('no stacking when maxTiers = 1', () => {
    const one = runPart({ part: hub, cartons: [S1], pallet: lowPallet, containers: [c20], settings: { maxTiers: 1 } });
    expect(one.cartons[0].containers[0].pallets).toBe(9);
  });
});

describe('runPart with real-shape packing (Phase 4)', () => {
  // A fake CAD-service answer: Column Stacking nests 40 parts in the carton (grid fits 8), 5 layers of 8.
  const realShape = { voxelMm: 1, computeMs: 10, cartons: [{ id: 'S1', methods: [
    { id: 'column', name: 'Column Stacking', count: 40, layers: 5, perLayer: 8, usedH: 150, pitch: [222, 222, 20], shift: [0, 0], rowShift: 0, nested: true, computeMs: 9, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], placements: Array.from({ length: 40 }, (_, i) => [0, 0, i]) }
  ] }] };
  const light = { ...hub, weightKg: 0.3 }; // 25 kg / 0.3 kg = 83 by weight, so 40 is the space limit
  const r = runPart({ part: light, cartons: [S1], pallet: lowPallet, containers: [c20], realShape });
  const c = r.cartons[0];

  it('quotes the best algorithm: 40 by Column Stacking instead of 8 by grid', () => {
    expect(c.perCarton).toBe(40);
    expect(c.method).toBe('column');
    expect(c.algorithms.find((a) => a.best).id).toBe('column');
    expect(c.algorithms.find((a) => a.id === 'grid').count).toBe(8);
  });
  it('trims the carton to the nested stack height (150 mm inside)', () => {
    expect(c.inner.h).toBe(150);
    expect(c.arrangements.column.placements).toHaveLength(40);
  });
  it('caps by the carton weight limit and uses only the layers needed', () => {
    const heavy = runPart({ part: { ...hub, weightKg: 1 }, cartons: [S1], pallet: lowPallet, containers: [c20], realShape }).cartons[0];
    // 25 kg / 1 kg = 25 parts → 4 layers of 8 → 150 − 1 × 20 = 130 mm
    expect(heavy.perCarton).toBe(25);
    expect(heavy.binding).toBe('Weight');
    expect(heavy.inner.h).toBe(130);
  });
});

describe('runPart with clusters (Phase 5)', () => {
  const copies = Array.from({ length: 48 }, () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const realShape = { voxelMm: 1, computeMs: 10, clusters: [{ index: 0, label: '180° Z', pcs: 2, size: [222, 220, 120], vsLoose: 120 }], clustersConsidered: 9, cartons: [{ id: 'S1', methods: [
    { id: 'cluster', name: 'Cluster Packing', count: 12, layers: 2, perLayer: 6, usedH: 240, pitch: [222, 220, 120], nested: false, computeMs: 5, clusterIndex: 0, piecesPerCluster: 2, copies: copies.slice(0, 12) }
  ] }] };
  it('uses Cluster Packing when it fits the most and keeps one matrix per piece', () => {
    const c = runPart({ part: { ...hub, weightKg: 1 }, cartons: [S1], pallet: lowPallet, containers: [c20], realShape }).cartons[0];
    expect(c.method).toBe('cluster');
    expect(c.perCarton).toBe(12);
    expect(c.arrangements.cluster.copies).toHaveLength(12);
  });
  it('passes the cluster list to the result (section 3)', () => {
    const r = runPart({ part: hub, cartons: [S1], pallet: lowPallet, containers: [c20], realShape });
    expect(r.clusters).toHaveLength(1);
    expect(r.clustersConsidered).toBe(9);
  });
});
