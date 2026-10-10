// Public, read-only phone view for the warehouse team. Steps through the pallets
// of each container in loading order (heaviest first, from the front wall).
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { textOn } from '../components/Pictures.jsx';
import { Check } from '../components/Icons.jsx';
import { num } from '../format.js';

export default function ShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [ci, setCi] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => { api.get(`/share/${token}`).then(setData).catch(setError); }, [token]);

  const ctx = useMemo(() => {
    if (!data) return null;
    const r = data.result;
    const g = r.goals[data.goal];
    const optFor = (lineIndex) => {
      const id = g.lines[lineIndex].recommendedId;
      return r.lines[lineIndex].options.find((o) => o.id === id);
    };
    return { r, g, optFor };
  }, [data]);

  if (error) return <div className="phone" style={{ padding: 24 }}><h1 className="h1" style={{ fontSize: 22 }}>Link not available</h1><p className="muted">{error.message}</p></div>;
  if (!ctx) return <div className="phone" style={{ padding: 24 }}><p className="muted">Loading plan…</p></div>;

  const { r, g, optFor } = ctx;
  const box = g.containers[ci];
  const total = box.slots.length;
  const cur = box.slots[Math.min(step, total - 1)];
  const line = r.lines[cur.lineIndex];
  const opt = optFor(cur.lineIndex);
  const n = cur.order;
  const rows = box.floor.rows;
  const along = Math.ceil(n / rows);
  const side = rows === 1 ? 'centre' : n % rows === 1 ? 'left side' : n % rows === 0 ? 'right side' : 'middle';
  const loadedKg = box.slots.slice(0, step).reduce((a, s) => a + s.kg, 0);
  const last = step >= total - 1;
  const lastBox = ci >= g.containers.length - 1;
  const slots = [...box.slots];
  while (slots.length < box.totalSlots) slots.push(null);

  const next = () => {
    if (!last) setStep(step + 1);
    else if (!lastBox) { setCi(ci + 1); setStep(0); }
  };
  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (ci > 0) { setCi(ci - 1); setStep(g.containers[ci - 1].slots.length - 1); }
  };

  return (
    <div className="phone">
      <header className="phone-head">
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--dark-muted)' }}>{data.orgName} · {data.name}</p>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Container {box.n} of {g.containers.length} · {r.container.name}</p>
        </div>
        <span className="pill-dark" style={{ fontSize: 12, color: '#C9CDD3' }}>Read only</span>
      </header>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
          <b>Step {step + 1} of {total}</b><span className="mono muted">{num(loadedKg)} kg loaded</span>
        </div>
        <div className="progress" role="progressbar" aria-label="Loading progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}><div style={{ width: `${(step / total) * 100}%` }} /></div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div role="img" aria-label="Container top view, current slot highlighted" className="container-box"
          style={{ aspectRatio: `${r.container.innerL} / ${r.container.innerW}`, gridTemplateColumns: `repeat(${box.floor.cols}, calc(${(box.floor.itemL / r.container.innerL) * 100}% - 3px))`, gridTemplateRows: `repeat(${rows}, calc(${(box.floor.itemW / r.container.innerW) * 100}% - 3px))`, gap: 3, padding: 3 }}>
          {slots.map((s, i) => {
            if (!s) return <div key={i} className="slot free" />;
            const c = r.lines[s.lineIndex].color;
            const state = i < step ? 'done' : i === step ? 'now' : 'next';
            return (
              <div key={i} className="slot" style={{
                background: state === 'next' ? '#E7E5DF' : c,
                color: state === 'next' ? '#3D434B' : textOn(c),
                border: state === 'now' ? '3px solid var(--accent)' : 0, fontSize: 13, fontWeight: 600
              }}>{state === 'done' ? '✓ ' : ''}{s.label}</div>
            );
          })}
        </div>
        <div className="ends"><span>◀ Front wall</span><span>Doors ▶</span></div>
      </div>

      <section className="now" aria-labelledby="now">
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--accent-ink)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Now load</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span aria-hidden="true" className="mono" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 10, background: line.color, color: textOn(line.color), fontSize: 22, fontWeight: 700, flex: 'none' }}>{cur.label}</span>
          <div>
            <h2 id="now" style={{ margin: 0, fontSize: 22 }}>{r.pallet.isFloorLoad ? 'Load' : 'Pallet'} {cur.label} → slot {n}</h2>
            <p style={{ margin: '2px 0 0', color: 'var(--ink-2)' }}>Row {along} from the front wall, {side}</p>
          </div>
        </div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[['Part', line.partName], ['Cartons', num(cur.cartons)], ['Weight', `${num(cur.kg)} kg`]].map(([k, v]) => (
            <div key={k} style={{ background: '#F7F6F2', borderRadius: 8, padding: '8px 10px' }}><dt className="muted" style={{ fontSize: 12 }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{v}</dd></div>
          ))}
        </dl>
        {opt && <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
          {opt.cartonName} · {opt.perLayer} per layer{r.pallet.isFloorLoad ? '' : ` × ${Math.ceil(cur.cartons / opt.perLayer)} layers`}{line.upright ? ' · this side up' : ''}.
        </p>}
      </section>

      <div className="phone-foot">
        <button className="btn btn-lg" onClick={back} disabled={step === 0 && ci === 0}>Back</button>
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={next} disabled={last && lastBox}>
          <Check size={20} />{last ? (lastBox ? 'All loaded' : 'Loaded · next container') : 'Loaded · next pallet'}
        </button>
      </div>
    </div>
  );
}
