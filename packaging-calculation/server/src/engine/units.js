// Everything inside the engine is millimetres and kilograms.
const LENGTH = { mm: 1, cm: 10, in: 25.4 };
const WEIGHT = { kg: 1, lb: 0.45359237 };

export function toMm(value, unit = 'mm') {
  const f = LENGTH[unit];
  if (!f) throw new Error(`Unknown length unit "${unit}"`);
  return round(Number(value) * f, 2);
}

export function toKg(value, unit = 'kg') {
  const f = WEIGHT[unit];
  if (!f) throw new Error(`Unknown weight unit "${unit}"`);
  return round(Number(value) * f, 4);
}

export function round(n, digits = 0) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
