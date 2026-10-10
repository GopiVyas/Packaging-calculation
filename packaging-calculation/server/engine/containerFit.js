import { dimensionsInMm } from './units.js'

export function palletsPerContainer(pallet, container) {
  const palletBox = dimensionsInMm(pallet.dimensions)
  const containerBox = dimensionsInMm(container.dimensions)
  const alongLength = Math.floor(containerBox.length / palletBox.length) * Math.floor(containerBox.width / palletBox.width)
  const rotated = Math.floor(containerBox.length / palletBox.width) * Math.floor(containerBox.width / palletBox.length)
  return Math.max(alongLength, rotated) * Math.floor(containerBox.height / palletBox.height)
}

export const containersNeeded = (palletCount, palletsPerContainerCount) => Math.ceil(palletCount / palletsPerContainerCount)