/**
 * Puts the pallets of every order line into containers together.
 * Heaviest pallets first (they go against the front wall), first container with a free slot
 * and enough payload left. Slot numbers are the loading order.
 *
 * lines: [{ index, label, partName, option }]  (option = the recommended planLine result)
 */
export function packContainers(lines, container, floorLoad = false) {
  const pallets = [];
  for (const line of lines) {
    const o = line.option;
    if (!o) continue;
    for (let i = 1; i <= o.pallets; i++) {
      const last = i === o.pallets;
      pallets.push({
        label: `${line.label}${i}`,
        lineIndex: line.index,
        partName: line.partName,
        cartons: last ? o.lastPalletCartons : o.perPallet,
        kg: last ? o.lastPalletKg : o.palletKg,
        slotsInContainer: o.perContainer,
        floor: o.containerFloor
      });
    }
  }
  pallets.sort((a, b) => b.kg - a.kg || a.lineIndex - b.lineIndex);

  const boxes = [];
  for (const p of pallets) {
    let box = boxes.find((b) => b.items.length < b.capacity && b.kg + p.kg <= container.payloadKg + 1e-9);
    if (!box) {
      box = { capacity: floorLoad ? 1 : p.slotsInContainer, floor: p.floor, items: [], kg: 0 };
      boxes.push(box);
    }
    box.items.push(p);
    box.kg += p.kg;
  }

  return boxes.map((b, i) => ({
    n: i + 1,
    totalSlots: floorLoad ? 1 : b.floor.count,
    used: b.items.length,
    kg: Math.round(b.kg),
    payloadKg: container.payloadKg,
    floor: b.floor,
    slots: b.items.map((p, j) => ({ order: j + 1, label: p.label, lineIndex: p.lineIndex, cartons: p.cartons, kg: p.kg }))
  }));
}
