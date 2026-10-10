export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
export const num = (n, d = 0) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: d });
export const dims = (a, b, c) => [a, b, c].map((x) => num(x, 1)).join(' × ');

export const SHAPE_LABELS = { box: 'Box', square: 'Square', circle: 'Circle', diamond: 'Diamond', other: 'Other' };
export const FIELD_LABELS = {
  length: 'Length', width: 'Width', height: 'Height', side: 'Side', diameter: 'Diameter',
  diagonal1: 'Diagonal 1', diagonal2: 'Diagonal 2', thickness: 'Thickness'
};
export const SHAPE_FIELDS = {
  box: ['length', 'width', 'height'],
  square: ['side', 'height'],
  circle: ['diameter', 'height'],
  diamond: ['diagonal1', 'diagonal2', 'thickness'],
  other: ['length', 'width', 'height']
};
export const SHAPE_HINTS = {
  box: 'A rectangular part, or a part already in its own box.',
  square: 'Equal sides: enter one side and the height.',
  circle: 'A round part packs in a square as wide as its diameter.',
  diamond: 'The box takes the two diagonals and the thickness.',
  other: 'Measure the smallest box the part fits in.'
};
export const GOALS = [
  { id: 'cost', name: 'Lowest cost', desc: 'Carton price plus freight per container' },
  { id: 'containers', name: 'Fewest containers', desc: 'Ship in as few containers as possible' },
  { id: 'cartons', name: 'Fewest cartons', desc: 'Less packing and handling' },
  { id: 'space', name: 'Best use of space', desc: 'Fullest pallets and containers' }
];

export function partSummary(p) {
  const d = p.dims || {};
  if (p.shape === 'cad') return `${p.cad?.format || 'CAD'} · ${p.cad?.fileName || ''}`;
  if (p.shape === 'circle') return `Circle · Ø${num(d.diameter, 1)} × ${num(d.height, 1)} ${p.unit}`;
  if (p.shape === 'square') return `Square · ${num(d.side, 1)} × ${num(d.height, 1)} ${p.unit}`;
  if (p.shape === 'diamond') return `Diamond · ${num(d.diagonal1, 1)} × ${num(d.diagonal2, 1)} × ${num(d.thickness, 1)} ${p.unit}`;
  return `${SHAPE_LABELS[p.shape]} · ${num(d.length, 1)} × ${num(d.width, 1)} × ${num(d.height, 1)} ${p.unit}`;
}

const CUR_SYMBOL = { INR: '₹', EUR: '€', USD: '$', GBP: '£' };
/** Small amounts (cost per piece) keep 2–4 decimals: ₹0.0168, ₹56.63 */
export function money(n, cur = 'INR') {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const d = v < 1 ? 4 : 2;
  return `${CUR_SYMBOL[cur] || cur + ' '}${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
