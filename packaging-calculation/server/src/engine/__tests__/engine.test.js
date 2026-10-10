// Hand-checked examples. Every number below was worked out on paper first
// (same sample order as the design: 2,000 wheel hubs + 600 brake discs,
// Industrial pallet 1200×1000, 20 ft container, freight ₹1,20,000 per container).
import { describe, it, expect } from 'vitest';
import { boxForShape, toMm, toKg, calculatePlan, suggestCartons, planLine } from '../index.js';
import { fitPartsInCarton, fitCartonsOnPallet, fitPalletsInContainer } from '../fit.js';

const hub = { _id: 'hub', name: 'Wheel hub', box: { l: 220, w: 220, h: 120 }, weightKg: 2.4, upright: true };
const disc = { _id: 'disc', name: 'Brake disc', box: { l: 300, w: 300, h: 60 }, weightKg: 4.5, upright: false };

const cartons = {
  A: { _id: 'A', name: 'Carton A', innerL: 600, innerW: 400, innerH: 300, wallMm: 5, maxWeightKg: 30, emptyWeightKg: 0.9, price: 70 },
  B: { _id: 'B', name: 'Carton B', innerL: 500, innerW: 500, innerH: 260, wallMm: 5, maxWeightKg: 30, emptyWeightKg: 1.0, price: 90 },
  S1: { _id: 'S1', name: 'Carton S1', innerL: 445, innerW: 445, innerH: 245, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.8, price: 78 },
  S2: { _id: 'S2', name: 'Carton S2', innerL: 665, innerW: 225, innerH: 245, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.7, price: 55 },
  S3: { _id: 'S3', name: 'Carton S3', innerL: 445, innerW: 445, innerH: 125, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.5, price: 45 },
  D1: { _id: 'D1', name: 'Carton D1', innerL: 305, innerW: 305, innerH: 250, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.6, price: 40 }
};
const industrial = { name: 'Industrial', L: 1200, W: 1000, deckH: 150, maxStackH: 1800, maxLoadKg: 1000, weightKg: 25 };
const c20 = { name: '20 ft standard', innerL: 5898, innerW: 2352, innerH: 2393, payloadKg: 28200 };
const FREIGHT = 120000;

describe('units and shapes', () => {
  it('converts units', () => {
    expect(toMm(30, 'cm')).toBe(300);
    expect(toMm(1, 'in')).toBe(25.4);
    expect(toKg(10, 'lb')).toBeCloseTo(4.5359, 3);
  });
  it('turns each shape into the box it needs', () => {
    expect(boxForShape('circle', { diameter: 300, height: 60 })).toEqual({ l: 300, w: 300, h: 60 });
    expect(boxForShape('square', { side: 20, height: 2.5 }, 'cm')).toEqual({ l: 200, w: 200, h: 25 });
    expect(boxForShape('diamond', { diagonal1: 240, diagonal2: 160, thickness: 30 }, 'mm', 2)).toEqual({ l: 244, w: 164, h: 34 });
    expect(() => boxForShape('box', { length: 10, width: 0, height: 5 })).toThrow();
  });
});

describe('parts in a carton', () => {
  it('upright hub: 2 × 1 × 2 = 4 in Carton A, 2 × 2 × 2 = 8 in Carton B', () => {
    expect(fitPartsInCarton(hub.box, 2.4, true, cartons.A)).toMatchObject({ perCarton: 4, grid: { nx: 2, ny: 1, nz: 2 } });
    expect(fitPartsInCarton(hub.box, 2.4, true, cartons.B)).toMatchObject({ perCarton: 8, grid: { nx: 2, ny: 2, nz: 2 } });
  });
  it('an upright part is never laid on its side', () => {
    const tall = { l: 100, w: 100, h: 400 };
    expect(fitPartsInCarton(tall, 1, true, { innerL: 450, innerW: 100, innerH: 100, maxWeightKg: 99 }).perCarton).toBe(0);
    expect(fitPartsInCarton(tall, 1, false, { innerL: 450, innerW: 100, innerH: 100, maxWeightKg: 99 }).perCarton).toBe(1);
  });
  it('caps by the carton weight limit', () => {
    // Discs on edge: 600/300 × 400/60 × 300/300 = 2 × 6 × 1 = 12 fit by space, but 30 kg / 4.5 kg = 6
    const r = fitPartsInCarton(disc.box, 4.5, false, cartons.A);
    expect(r).toMatchObject({ perCarton: 6, spaceCount: 12, limitedBy: 'weight' });
  });
});

describe('cartons on a pallet, pallets in a container', () => {
  it('Carton S1 (455 × 455 × 255 outside): 4 per layer × 6 layers = 24, 505 kg', () => {
    const r = fitCartonsOnPallet({ l: 455, w: 455, h: 255 }, 20.0, industrial);
    expect(r).toMatchObject({ perLayer: 4, layers: 6, perPallet: 24, limitedBy: 'space' });
    expect(r.palletKg).toBeCloseTo(505, 6);
    expect(r.fill).toBeCloseTo(0.64, 2);
  });
  it('Carton S2 turns on the pallet: 5 per layer', () => {
    const r = fitCartonsOnPallet({ l: 675, w: 235, h: 255 }, 15.1, industrial);
    expect(r).toMatchObject({ perLayer: 5, layers: 6, perPallet: 30 });
    expect(r.layer.rotated).toBe(true);
  });
  it('brake disc pallet is limited by weight: 54 fit, 53 allowed', () => {
    const r = fitCartonsOnPallet({ l: 315, w: 315, h: 260 }, 18.6, industrial);
    expect(r).toMatchObject({ perLayer: 9, layers: 6, perPallet: 53, limitedBy: 'weight' });
  });
  it('20 ft container takes 8 Industrial pallets on the floor', () => {
    const r = fitPalletsInContainer(1200, 1000, 1680, 505, c20);
    expect(r).toMatchObject({ slots: 8, perContainer: 8, floor: { cols: 4, rows: 2 } });
  });
  it('a pallet taller than the container does not fit', () => {
    expect(fitPalletsInContainer(1200, 1000, 2500, 505, c20).perContainer).toBe(0);
  });
});

describe('whole line', () => {
  const run = (carton) => planLine({ part: hub, qty: 2000, carton, pallet: industrial, container: c20, freightCost: FREIGHT });
  it.each([
    ['S1', 250, 11, 2, 259500],
    ['S2', 334, 12, 2, 258370],
    ['S3', 500, 11, 2, 262500],
    ['B', 250, 21, 3, 382500],
    ['A', 500, 50, 7, 875000]
  ])('%s: %i cartons, %i pallets, %i containers, ₹%i', (id, cartonsN, pallets, containers, cost) => {
    expect(run(cartons[id])).toMatchObject({ cartons: cartonsN, pallets, containers, totalCost: cost });
  });
});

describe('ranking by goal and the mixed order', () => {
  const result = calculatePlan({
    lines: [{ part: hub, qty: 2000 }, { part: disc, qty: 600 }],
    cartons: [cartons.A, cartons.B, cartons.S1, cartons.S2, cartons.S3],
    pallet: industrial,
    container: c20,
    freightCost: FREIGHT
  });
  const discOnly = calculatePlan({ lines: [{ part: disc, qty: 600 }], cartons: [cartons.D1], pallet: industrial, container: c20, freightCost: FREIGHT });

  it('picks S2 for lowest cost, S1 for fewest containers and cartons, S3 for space', () => {
    expect(result.goals.cost.lines[0].recommendedId).toBe('S2');
    expect(result.goals.containers.lines[0].recommendedId).toBe('S1');
    expect(result.goals.cartons.lines[0].recommendedId).toBe('S1');
    expect(result.goals.space.lines[0].recommendedId).toBe('S3');
  });
  it('explains the pick in plain words', () => {
    expect(result.goals.cost.lines[0].explanation).toContain('₹1,130 less than the next option, Carton S1');
    expect(result.goals.cartons.lines[0].explanation).toContain('wins on fewer containers');
  });
  it('brake disc in D1: 150 cartons, 3 pallets, last pallet 44 cartons', () => {
    const o = discOnly.lines[0].options[0];
    expect(o).toMatchObject({ perCarton: 4, cartons: 150, pallets: 3, lastPalletCartons: 44 });
    expect(o.palletKg).toBeCloseTo(1010.8, 1);
  });
  it('packs heaviest pallets first and every pallet once', () => {
    const boxes = result.goals.cost.containers;
    const all = boxes.flatMap((b) => b.slots);
    const totalPallets = result.lines.reduce((a, l, i) => a + l.options.find((o) => o.id === result.goals.cost.lines[i].recommendedId).pallets, 0);
    expect(all.length).toBe(totalPallets);
    expect(boxes[0].slots[0].kg).toBeGreaterThanOrEqual(boxes[0].slots.at(-1).kg);
    boxes.forEach((b) => expect(b.used).toBeLessThanOrEqual(b.totalSlots));
  });
});

describe('carton suggestions', () => {
  const picks = suggestCartons({ part: hub, pallet: industrial, container: c20, qty: 2000, freightCost: FREIGHT });
  it('returns up to 3 cartons within the size and weight limits', () => {
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(3);
    for (const p of picks) {
      expect(p.plan.grossKg).toBeLessThanOrEqual(25);
      expect(p.carton.innerL + 10).toBeLessThanOrEqual(700);
    }
  });
  it('the best pallet fit beats the cartons on hand', () => {
    const bestFit = picks.find((p) => p.reasons.includes('Best pallet fit'));
    expect(bestFit.plan.partsPerPallet).toBeGreaterThanOrEqual(192);
  });
});
