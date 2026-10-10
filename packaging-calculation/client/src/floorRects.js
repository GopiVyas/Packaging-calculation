// Pallet / carton positions on a floor (mm). New results carry `rects` (mixed directions allowed);
// results saved before that only have a cols × rows grid, rebuilt here.
export function floorRects(floor) {
  if (floor?.rects?.length) return floor.rects;
  const out = [];
  for (let i = 0; i < (floor?.cols || 0); i++) {
    for (let j = 0; j < (floor?.rows || 0); j++) out.push({ x: i * floor.itemL, y: j * floor.itemW, l: floor.itemL, w: floor.itemW });
  }
  return out;
}

/** Absolute position of slot i in a top view of an L × W floor (percentages, with a small gap). */
export function slotStyle(rect, L, W, gapPx = 2) {
  if (!rect) return { display: 'none' };
  return {
    position: 'absolute',
    left: `calc(${(rect.x / L) * 100}% + ${gapPx}px)`,
    top: `calc(${(rect.y / W) * 100}% + ${gapPx}px)`,
    width: `calc(${(rect.l / L) * 100}% - ${2 * gapPx}px)`,
    height: `calc(${(rect.w / W) * 100}% - ${2 * gapPx}px)`
  };
}
