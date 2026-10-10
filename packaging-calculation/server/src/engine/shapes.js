import { toMm } from './units.js';

// The fields each shape asks for (the client builds its form from this too).
export const SHAPE_FIELDS = {
  box: ['length', 'width', 'height'],
  square: ['side', 'height'],
  circle: ['diameter', 'height'],
  diamond: ['diagonal1', 'diagonal2', 'thickness'],
  other: ['length', 'width', 'height']
};

/**
 * The box (in mm) a part needs, from its shape and the sizes the user typed.
 * Round and odd shapes are packed as their bounding box (no nesting in this version).
 * clearanceMm is added on every side.
 */
export function boxForShape(shape, dims, unit = 'mm', clearanceMm = 0) {
  const fields = SHAPE_FIELDS[shape];
  if (!fields) throw new Error(`Unknown shape "${shape}"`);
  const d = {};
  for (const f of fields) {
    const v = Number(dims?.[f]);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Enter a ${f} greater than 0`);
    d[f] = toMm(v, unit);
  }
  let l, w, h;
  switch (shape) {
    case 'box':
    case 'other':
      [l, w, h] = [d.length, d.width, d.height];
      break;
    case 'square':
      [l, w, h] = [d.side, d.side, d.height];
      break;
    case 'circle':
      [l, w, h] = [d.diameter, d.diameter, d.height];
      break;
    case 'diamond':
      [l, w, h] = [d.diagonal1, d.diagonal2, d.thickness];
      break;
  }
  const c = 2 * (Number(clearanceMm) || 0);
  return { l: l + c, w: w + c, h: h + c };
}
