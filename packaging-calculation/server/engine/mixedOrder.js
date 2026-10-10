export function distributePallets(pallets, containerCapacity) {
  if (containerCapacity < 1) return []
  const containers = []
  for (const pallet of pallets) {
    let container = containers.at(-1)
    if (!container || container.pallets.length >= containerCapacity) {
      container = { pallets: [], usedSlots: 0 }
      containers.push(container)
    }
    container.pallets.push(pallet)
    container.usedSlots += 1
  }
  return containers
}