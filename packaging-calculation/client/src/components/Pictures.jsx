// Loading pictures, drawn to scale from the engine's numbers (no 3D in this version).
import { num } from '../format.js';
import { floorRects, slotStyle } from '../floorRects.js';

export function textOn(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.5 ? '#16191D' : '#FFFFFF';
}

/** 1 · Top view of one layer of parts inside the carton */
export function CartonPic({ option, color = '#2F6DB5', max = 200 }) {
  const { inner, grid, partOrient } = option;
  const s = max / Math.max(inner.l, inner.w);
  const [a, b] = partOrient;
  return (
    <div
      role="img"
      aria-label={`Carton top view: ${grid.nx} by ${grid.ny} parts, ${grid.nz} layers`}
      style={{
        width: inner.l * s + 10, height: inner.w * s + 10, border: '2px solid #8A6A3F', background: 'var(--kraft)',
        padding: 3, display: 'grid', gridTemplateColumns: `repeat(${grid.nx}, ${a * s}px)`, gridAutoRows: `${b * s}px`, alignContent: 'start'
      }}
    >
      {Array.from({ length: grid.nx * grid.ny }, (_, i) => (
        <div key={i} className="cell-part" style={{ margin: 2, background: color, color: textOn(color) }}>↑</div>
      ))}
    </div>
  );
}

/** 2 · Top view of one pallet layer, cartons numbered in placing order */
export function PalletPic({ option, pallet, max = 264 }) {
  const { layer } = option;
  const s = max / Math.max(pallet.L, pallet.W);
  return (
    <div
      role="img"
      aria-label={`Pallet layer with ${option.perLayer} cartons`}
      style={{
        width: pallet.L * s, height: pallet.W * s,
        background: 'repeating-linear-gradient(90deg, #B98F57 0, #B98F57 30px, #A37A45 30px, #A37A45 34px)',
        position: 'relative'
      }}
    >
      {floorRects(layer).map((q, i) => (
        <div key={i} className="cell-carton" style={{ position: 'absolute', left: q.x * s, top: q.y * s, width: q.l * s, height: q.w * s }}>{i + 1}</div>
      ))}
    </div>
  );
}

/** 3 · Side view: layers stacked on the pallet under the height limit */
export function StackPic({ option, pallet, width = 264, height = 210 }) {
  const s = height / pallet.maxStackH;
  const sx = width / pallet.L;
  const used = Math.ceil(option.perPallet / option.perLayer);
  return (
    <div role="img" aria-label={`${used} layers stacked`} style={{ width, height, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderTop: '2px dashed var(--accent)', position: 'relative' }}>
      <span className="mono" style={{ position: 'absolute', top: -20, right: 0, fontSize: 11, color: 'var(--accent-ink)' }}>
        {num(pallet.maxStackH)} mm limit
      </span>
      {Array.from({ length: used }, (_, i) => (
        <div key={i} style={{ display: 'flex', height: option.outer.h * s }}>
          {floorRects(option.layer).filter((q) => q.y < 1e-6).map((q, j) => (
            <div key={j} className="cell-carton" style={{ width: q.l * sx, borderWidth: 1.5 }} />
          ))}
        </div>
      ))}
      {pallet.deckH > 0 && (
        <div style={{ height: Math.max(6, pallet.deckH * s), background: 'repeating-linear-gradient(90deg, #8A6A3F 0, #8A6A3F 24px, transparent 24px, transparent 40px)', borderTop: '5px solid #A37A45' }} />
      )}
    </div>
  );
}

/** 4 · Top view of a container: pallet slots in loading order, coloured by part */
export function ContainerPic({ box, container, lines }) {
  const rects = floorRects(box.floor);
  const slots = [...box.slots];
  while (slots.length < box.totalSlots) slots.push(null);
  return (
    <div>
      <div
        role="img"
        aria-label={`Container ${box.n} top view`}
        className="container-box"
        style={{ aspectRatio: `${container.innerL} / ${container.innerW}`, position: 'relative', display: 'block' }}
      >
        {slots.map((s, i) => {
          const pos = slotStyle(rects[i], container.innerL, container.innerW);
          if (!s) return <div key={i} className="slot free" style={pos}><small>free</small></div>;
          const c = lines[s.lineIndex]?.color || '#5A6069';
          return (
            <div key={i} className="slot" style={{ ...pos, background: c, color: textOn(c) }} title={`${s.cartons} cartons · ${num(s.kg)} kg`}>
              <b>{s.label}</b><small>#{s.order}</small>
            </div>
          );
        })}
      </div>
      <div className="ends"><span>◀ Front wall</span><span>Doors ▶</span></div>
    </div>
  );
}
