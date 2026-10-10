import { partsPerCarton } from './cartonFit.js'

export function suggestCartons(part, cartons) {
  return cartons.map((carton) => ({ carton, capacity: partsPerCarton(part, carton) })).filter((item) => item.capacity > 0).sort((a, b) => a.capacity - b.capacity)
}