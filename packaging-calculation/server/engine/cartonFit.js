import { boundingBox } from './shapes.js'

const orientations = (box) => [[box.length, box.width, box.height], [box.length, box.height, box.width], [box.width, box.length, box.height], [box.width, box.height, box.length], [box.height, box.length, box.width], [box.height, box.width, box.length]]

export function partsPerCarton(part, carton) {
  const partBox = boundingBox(part.shape, part.dimensions)
  const cartonBox = boundingBox('box', carton.dimensions)
  return Math.max(...orientations(partBox).map(([l, w, h]) => Math.floor(cartonBox.length / l) * Math.floor(cartonBox.width / w) * Math.floor(cartonBox.height / h)))
}