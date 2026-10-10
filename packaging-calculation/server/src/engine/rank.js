// Ranking options by the customer's goal, and explaining the pick in plain words.

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const num = (n) => Number(n).toLocaleString('en-IN');
const s = (n, word) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;

// Each goal sorts by its keys in order; later keys break ties.
const KEYS = {
  totalCost: { label: 'lower total cost', get: (o) => o.totalCost, fmt: (o) => inr(o.totalCost) },
  containers: { label: 'fewer containers', get: (o) => o.containers, fmt: (o) => s(o.containers, 'container') },
  cartons: { label: 'fewer cartons', get: (o) => o.cartons, fmt: (o) => s(o.cartons, 'carton') },
  fill: { label: 'fuller pallets', get: (o) => -o.fill, fmt: (o) => `${o.fill}% pallet space used` }
};

export const GOALS = {
  cost: { name: 'Lowest cost', keys: ['totalCost', 'containers', 'cartons'] },
  containers: { name: 'Fewest containers', keys: ['containers', 'cartons', 'totalCost'] },
  cartons: { name: 'Fewest cartons', keys: ['cartons', 'containers', 'totalCost'] },
  space: { name: 'Best use of space', keys: ['fill', 'containers', 'totalCost'] }
};

export function rankOptions(options, goal) {
  const keys = (GOALS[goal] || GOALS.cost).keys;
  return [...options].sort((a, b) => {
    for (const k of keys) {
      const d = KEYS[k].get(a) - KEYS[k].get(b);
      if (Math.abs(d) > 1e-9) return d;
    }
    return a.cartonName.localeCompare(b.cartonName);
  });
}

function lead(goal, best, ctx) {
  switch (goal) {
    case 'containers': return `${best.cartonName} needs the fewest containers: ${best.containers} × ${ctx.containerName}.`;
    case 'cartons': return `${best.cartonName} needs the fewest cartons: ${num(best.cartons)}.`;
    case 'space': return `${best.cartonName} fills the pallets best, using ${best.fill}% of the usable pallet space.`;
    default: return `${best.cartonName} gives the lowest total cost: ${inr(best.totalCost)} for cartons and freight.`;
  }
}

function comparison(goal, ranked) {
  const [best, second] = ranked;
  if (!second) return 'It is the only carton on the list that fits this part.';
  const keys = (GOALS[goal] || GOALS.cost).keys;
  const primary = KEYS[keys[0]];
  if (Math.abs(primary.get(best) - primary.get(second)) > 1e-9) {
    if (goal === 'cost') return `That is ${inr(second.totalCost - best.totalCost)} less than the next option, ${second.cartonName}.`;
    return `Next best is ${second.cartonName} with ${primary.fmt(second)}.`;
  }
  const tied = ranked.filter((o) => o !== best && Math.abs(primary.get(o) - primary.get(best)) < 1e-9);
  const names = tied.map((o) => o.cartonName);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  const decider = keys.slice(1).map((k) => KEYS[k]).find((k) => Math.abs(k.get(best) - k.get(second)) > 1e-9);
  const tieText = `${list} ${tied.length > 1 ? 'are' : 'is'} level on that`;
  return decider
    ? `${tieText}; ${best.cartonName} wins on ${decider.label} (${decider.fmt(best)} vs ${decider.fmt(second)}).`
    : `${tieText}.`;
}

function body(best, ctx) {
  const g = best.grid;
  const parts = [`It holds ${s(best.perCarton, ctx.unitWord)} (${g.nx} × ${g.ny} × ${g.nz}).`];
  if (ctx.floorLoad) {
    parts.push(`Loaded straight on the container floor, ${best.perLayer} cartons fit per layer and ${best.layers} layers fit in the height, so one container takes ${num(best.perPallet)} cartons.`);
    parts.push(`The order needs ${s(best.containers, 'container')}.`);
  } else {
    parts.push(`${best.perLayer} cartons fit on each pallet layer and ${best.layers} layers fit under the ${num(ctx.maxStackH)} mm height limit, so a pallet carries ${num(best.partsPerPallet)}.`);
    parts.push(`The ${s(best.pallets, 'pallet')} fit in ${best.containers} × ${ctx.containerName}.`);
    parts.push(
      best.palletLimitedBy === 'weight'
        ? `Pallets are limited by weight: each weighs ${num(best.palletKg)} kg against the ${num(ctx.maxLoadKg)} kg pallet limit.`
        : `Space is the limit, not weight: each pallet weighs ${num(best.palletKg)} kg of the ${num(ctx.maxLoadKg)} kg allowed.`
    );
  }
  if (best.cartonLimitedBy === 'weight') parts.push(`The carton is filled to its weight limit, not its space.`);
  return parts.join(' ');
}

export function explain(goal, ranked, ctx) {
  if (!ranked.length) return `None of the selected cartons can hold ${ctx.partName}. Try a larger carton or ask for suggestions.`;
  return [lead(goal, ranked[0], ctx), comparison(goal, ranked), body(ranked[0], ctx)].join(' ');
}
