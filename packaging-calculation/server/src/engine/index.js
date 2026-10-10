import { planLine, effectivePallet } from './planLine.js';
import { rankOptions, explain, GOALS } from './rank.js';
import { packContainers } from './mixedOrder.js';
import { round } from './units.js';

export { boxForShape, SHAPE_FIELDS } from './shapes.js';
export { suggestCartons, SUGGEST_DEFAULTS } from './suggest.js';
export { toMm, toKg } from './units.js';
export { GOALS } from './rank.js';
export { planLine } from './planLine.js';

export const LINE_COLORS = ['#2F6DB5', '#F2B33D', '#2E8B6E', '#B5462F', '#7A5BB5', '#5A6069'];

/**
 * The whole calculation. Results for all four goals are returned at once,
 * so the user can switch the goal on screen without another request.
 *
 * lines:     [{ part: { _id, name, box:{l,w,h}, weightKg, upright }, qty }]
 * cartons:   saved cartons to compare (mm/kg)
 * pallet:    saved pallet, or { isFloorLoad: true }
 * container: saved container
 */
export function calculatePlan({ lines, cartons, pallet, container, freightCost = 0 }) {
  const p = effectivePallet(pallet, container);
  const floorLoad = !!p.isFloorLoad;

  const lineResults = lines.map((ln, i) => ({
    index: i,
    label: String.fromCharCode(65 + (i % 26)),
    partId: String(ln.part._id ?? ln.part.id ?? i),
    partName: ln.part.name,
    qty: ln.qty,
    color: LINE_COLORS[i % LINE_COLORS.length],
    box: ln.part.box,
    weightKg: ln.part.weightKg,
    upright: !!ln.part.upright,
    options: cartons
      .map((carton) => planLine({ part: ln.part, qty: ln.qty, carton, pallet, container, freightCost }))
      .filter(Boolean)
  }));

  const goals = {};
  for (const goal of Object.keys(GOALS)) {
    const perLine = lineResults.map((l) => {
      const ranked = rankOptions(l.options, goal);
      return {
        order: ranked.map((o) => o.id),
        recommendedId: ranked[0]?.id ?? null,
        explanation: explain(goal, ranked, {
          partName: l.partName,
          unitWord: 'part',
          containerName: container.name,
          maxStackH: p.maxStackH,
          maxLoadKg: p.maxLoadKg,
          floorLoad
        })
      };
    });
    const packed = packContainers(
      lineResults.map((l, i) => ({
        index: i,
        label: l.label,
        partName: l.partName,
        option: l.options.find((o) => o.id === perLine[i].recommendedId) || null
      })),
      container,
      floorLoad
    );
    const chosen = lineResults.map((l, i) => l.options.find((o) => o.id === perLine[i].recommendedId)).filter(Boolean);
    const cartonCost = chosen.reduce((a, o) => a + o.cartonCost, 0);
    const freight = packed.length * freightCost;
    goals[goal] = {
      lines: perLine,
      containers: packed,
      totals: {
        containers: packed.length,
        pallets: floorLoad ? 0 : chosen.reduce((a, o) => a + o.pallets, 0),
        cartons: chosen.reduce((a, o) => a + o.cartons, 0),
        cartonCost: round(cartonCost, 2),
        freightCost: round(freight, 2),
        totalCost: round(cartonCost + freight, 2),
        unplannedLines: lineResults.filter((_, i) => !perLine[i].recommendedId).map((l) => l.partName)
      }
    };
  }

  return {
    calculatedAt: new Date().toISOString(),
    pallet: { name: p.name, L: p.L, W: p.W, deckH: p.deckH, maxStackH: p.maxStackH, maxLoadKg: p.maxLoadKg, weightKg: p.weightKg, isFloorLoad: floorLoad },
    container: { name: container.name, innerL: container.innerL, innerW: container.innerW, innerH: container.innerH, payloadKg: container.payloadKg },
    freightCost,
    lines: lineResults,
    goals
  };
}
export { runPart, RUN_DEFAULTS, ALGORITHMS } from './run.js';
