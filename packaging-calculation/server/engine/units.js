const lengthToMm = { mm: 1, cm: 10, in: 25.4 }
const weightToKg = { kg: 1, lb: 0.45359237 }

export const toMm = (value, unit = 'mm') => value * (lengthToMm[unit] ?? 1)
export const toKg = (value, unit = 'kg') => value * (weightToKg[unit] ?? 1)
export const dimensionsInMm = (dimensions) => ({ length: toMm(dimensions.length, dimensions.unit), width: toMm(dimensions.width, dimensions.unit), height: toMm(dimensions.height, dimensions.unit) })