import { dimensionsInMm } from './units.js'

export function boundingBox(shape = 'box', dimensions) {
  const normalized = dimensionsInMm(dimensions)
  if (shape === 'cylinder') return { length: normalized.length, width: normalized.length, height: normalized.height }
  if (shape === 'sphere') return { length: normalized.length, width: normalized.length, height: normalized.length }
  return normalized
}

export const volume = (box) => box.length * box.width * box.height