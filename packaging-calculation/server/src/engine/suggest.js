import { orientations } from './fit.js';
import { planLine } from './planLine.js';
import { round } from './units.js';

export const SUGGEST_DEFAULTS = {
  maxOuter: [700, 500, 500], // longest side, other side, height (mm)
  maxGrossKg: 25, // full carton weight a person can lift
  wallMm: 5,
  slackMm: 5, // spare room inside the carton on each dimension
  maxPartsPerCarton: 60,
  pricePerM2: 80, // board price estimate (INR per m² of carton surface)
  boardKgPerM2: 0.9
};

/**
 * Builds carton sizes around the part (whole grids of parts + slack + wall),
 * keeps the ones within the size/weight limits, plans each on the chosen pallet
 * and container, and returns up to 3 distinct picks with the reason for each.
 */
export function suggestCartons({ part, pallet, container, qty = 1000, freightCost = 0, constraints = {} }) {
  const c = { ...SUGGEST_DEFAULTS, ...constraints };
  const [maxLong, maxShort, maxH] = c.maxOuter;
  // Upright parts keep their height; others may also stand on another face.
  const bases = part.upright
    ? [[part.box.l, part.box.w, part.box.h]]
    : orientations(part.box, false).filter((o, i, all) => all.findIndex((x) => x[2] === o[2]) === i);

  const seen = new Set();
  const candidates = [];
  for (const [a, b, h] of bases) {
    for (let nz = 1; nz <= 10; nz++) {
      for (let nx = 1; nx <= 10; nx++) {
        for (let ny = 1; ny <= 10; ny++) {
          const count = nx * ny * nz;
          if (count > c.maxPartsPerCarton) continue;
          let L = nx * a + c.slackMm;
          let W = ny * b + c.slackMm;
          if (W > L) [L, W] = [W, L];
          const H = nz * h + c.slackMm;
          const oL = L + 2 * c.wallMm, oW = W + 2 * c.wallMm, oH = H + 2 * c.wallMm;
          if (oL > maxLong || oW > maxShort || oH > maxH) continue;
          const key = `${round(L)}x${round(W)}x${round(H)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const areaM2 = (2 * (oL * oW + oL * oH + oW * oH)) / 1e6;
          const emptyWeightKg = round(areaM2 * c.boardKgPerM2, 1);
          if (count * part.weightKg + emptyWeightKg > c.maxGrossKg + 1e-9) continue;
          const carton = {
            _id: `suggest-${key}`,
            name: `Suggested ${round(L)}×${round(W)}×${round(H)}`,
            innerL: round(L), innerW: round(W), innerH: round(H),
            wallMm: c.wallMm,
            maxWeightKg: round(c.maxGrossKg - emptyWeightKg, 1),
            emptyWeightKg,
            price: Math.round(areaM2 * c.pricePerM2),
            isSuggested: true
          };
          const plan = planLine({ part, qty, carton, pallet, container, freightCost });
          if (!plan || plan.perCarton !== count) continue;
          candidates.push({ carton, plan });
        }
      }
    }
  }
  if (!candidates.length) return [];

  const byFit = [...candidates].sort((x, y) =>
    y.plan.partsPerPallet - x.plan.partsPerPallet || y.plan.perCarton - x.plan.perCarton || x.plan.totalCost - y.plan.totalCost);
  const bestFit = byFit[0];
  const byCost = [...candidates].sort((x, y) => x.plan.totalCost - y.plan.totalCost || y.plan.partsPerPallet - x.plan.partsPerPallet);
  const goodFit = candidates.filter((x) => x.plan.partsPerPallet >= 0.9 * bestFit.plan.partsPerPallet);
  const byCartons = [...goodFit].sort((x, y) => y.plan.perCarton - x.plan.perCarton || x.plan.totalCost - y.plan.totalCost);

  const picks = [];
  const add = (cand, reason) => {
    if (!cand) return;
    const existing = picks.find((p) => p.carton._id === cand.carton._id);
    if (existing) existing.reasons.push(reason);
    else picks.push({ ...cand, reasons: [reason] });
  };
  add(bestFit, 'Best pallet fit');
  add(byCost[0], 'Lowest cost');
  add(byCartons[0], 'Fewest cartons');
  for (const cand of byFit) {
    if (picks.length >= 3) break;
    if (!picks.some((p) => p.carton._id === cand.carton._id)) picks.push({ ...cand, reasons: ['Good pallet fit'] });
  }
  return picks.slice(0, 3);
}
