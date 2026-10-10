import { fitPartsInCarton, cartonOuter, fitCartonsOnPallet, fitPalletsInContainer } from './fit.js';
import { round } from './units.js';

/**
 * "No pallet" (floor load): the container floor acts as one big pallet,
 * so one "pallet" = one container. Keeps the rest of the maths identical.
 */
export function effectivePallet(pallet, container) {
  if (!pallet || pallet.isFloorLoad) {
    return {
      name: 'Floor load', isFloorLoad: true,
      L: container.innerL, W: container.innerW, deckH: 0,
      maxStackH: container.innerH, maxLoadKg: container.payloadKg, weightKg: 0
    };
  }
  return pallet;
}

/**
 * Full plan for one order line with one carton.
 * part: { box:{l,w,h}, weightKg, upright }   carton: saved carton (mm/kg)
 * Returns null when the part does not fit at all (the option is skipped).
 */
export function planLine({ part, qty, carton, pallet, container, freightCost = 0 }) {
  const fit = fitPartsInCarton(part.box, part.weightKg, part.upright, carton);
  if (fit.perCarton < 1) return null;

  const outer = cartonOuter(carton);
  const grossKg = fit.perCarton * part.weightKg + (carton.emptyWeightKg || 0);
  const p = effectivePallet(pallet, container);
  const pal = fitCartonsOnPallet(outer, grossKg, p);
  if (pal.perPallet < 1) return null;

  const con = p.isFloorLoad
    ? { slots: 1, perContainer: 1, floor: { cols: 1, rows: 1, rotated: false, itemL: p.L, itemW: p.W }, limitedBy: pal.limitedBy }
    : fitPalletsInContainer(p.L, p.W, pal.heightMm, pal.palletKg, container);
  if (con.perContainer < 1) return null;

  const cartons = Math.ceil(qty / fit.perCarton);
  const pallets = Math.ceil(cartons / pal.perPallet);
  const containers = Math.ceil(pallets / con.perContainer);
  const lastPalletCartons = cartons - (pallets - 1) * pal.perPallet;
  const cartonCost = cartons * (carton.price || 0);
  const freight = containers * freightCost;

  return {
    id: String(carton._id ?? carton.id ?? carton.name),
    cartonName: carton.name,
    isSuggested: !!carton.isSuggested,
    perCarton: fit.perCarton,
    grid: fit.grid,
    partOrient: fit.orient,
    cartonLimitedBy: fit.limitedBy,
    inner: { l: carton.innerL, w: carton.innerW, h: carton.innerH },
    outer,
    grossKg: round(grossKg, 2),
    perLayer: pal.perLayer,
    layers: pal.layers,
    perPallet: pal.perPallet,
    partsPerPallet: pal.perPallet * fit.perCarton,
    layer: pal.layer,
    palletLimitedBy: pal.limitedBy,
    palletKg: round(pal.palletKg, 1),
    palletHeightMm: pal.heightMm,
    fill: round(pal.fill * 100, 1),
    slots: con.slots,
    perContainer: con.perContainer,
    containerFloor: con.floor,
    containerLimitedBy: con.limitedBy,
    cartons,
    pallets,
    containers,
    lastPalletCartons,
    lastPalletKg: round(lastPalletCartons * grossKg + (p.weightKg || 0), 1),
    cartonCost: round(cartonCost, 2),
    freightCost: round(freight, 2),
    totalCost: round(cartonCost + freight, 2)
  };
}
