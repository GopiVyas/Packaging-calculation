import { dimensionsInMm } from './units.js'

export function cartonsPerPallet(carton, pallet) {
  const box = dimensionsInMm(carton.dimensions)
  const base = dimensionsInMm(pallet.dimensions)
  const layer = Math.max(Math.floor(base.length / box.length) * Math.floor(base.width / box.width), Math.floor(base.length / box.width) * Math.floor(base.width / box.length))
  return layer * Math.floor(base.height / box.height)
}