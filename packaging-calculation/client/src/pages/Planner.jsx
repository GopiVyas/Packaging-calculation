import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useCan } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { Arrow, Plus, Star } from '../components/Icons.jsx';
import { GOALS, dims, inr, num, partSummary } from '../format.js';

const COLORS = ['#2F6DB5', '#F2B33D', '#2E8B6E', '#B5462F', '#7A5BB5', '#5A6069'];

export default function Planner() {
  const { session } = useAuth();
  const can = useCan();
  const nav = useNavigate();
  const prefill = useLocation().state?.inputs;
  const [data, setData] = useState(null);
  const [lines, setLines] = useState([]);
  const [cartonIds, setCartonIds] = useState([]);
  const [palletId, setPalletId] = useState('');
  const [containerId, setContainerId] = useState('');
  const [freightCost, setFreightCost] = useState('');
  const [goal, setGoal] = useState(useLocation().state?.goal || 'cost');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/parts'), api.get('/cartons'), api.get('/pallets'), api.get('/containers')])
      .then(([parts, cartons, pallets, containers]) => {
        setData({ parts, cartons: cartons.filter((c) => c.active !== false), pallets, containers });
        if (prefill) {
          setLines(prefill.lines); setCartonIds(prefill.cartonIds); setPalletId(prefill.palletId);
          setContainerId(prefill.containerId); setFreightCost(prefill.freightCost ?? '');
        } else {
          setLines(parts.length ? [{ partId: parts[0]._id, qty: 1000 }] : []);
          setCartonIds(cartons.map((c) => c._id));
          setPalletId(pallets.find((p) => p.name.startsWith('Industrial'))?._id || pallets[0]?._id || 'floor');
          setContainerId(containers[0]?._id || '');
          setFreightCost(containers[0]?.freightCost ?? session.org.settings.defaultFreightCost);
        }
      })
      .catch(setError);
  }, []);

  if (!data) return <><ErrorNotice error={error} /><p className="muted">Loading…</p></>;
  const { parts, cartons, pallets, containers } = data;
  const partById = Object.fromEntries(parts.map((p) => [p._id, p]));
  const pallet = pallets.find((p) => p._id === palletId);
  const container = containers.find((c) => c._id === containerId);
  const totalQty = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const ready = lines.length && lines.every((l) => l.partId && Number(l.qty) > 0) && cartonIds.length && containerId;

  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const toggleCarton = (id) => setCartonIds(cartonIds.includes(id) ? cartonIds.filter((x) => x !== id) : [...cartonIds, id]);
  const pickContainer = (c) => { setContainerId(c._id); setFreightCost(c.freightCost); };

  const calculate = async () => {
    setBusy(true);
    setError(null);
    const inputs = { lines: lines.map((l) => ({ partId: l.partId, qty: Number(l.qty) })), cartonIds, palletId, containerId, freightCost: Number(freightCost) || 0 };
    try {
      const result = await api.post('/plans/calculate', inputs);
      nav('/result', { state: { inputs, result, goal } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!parts.length || !cartons.length) {
    return (
      <section className="card stack">
        <h1 className="h1" style={{ fontSize: 26 }}>Let’s set up your first plan</h1>
        <p className="muted" style={{ margin: 0 }}>Add at least one part and one carton. Standard pallets and containers are ready to use.</p>
        <div className="inline">
          <Link className="btn btn-primary" to="/parts">{parts.length ? '✓ Parts added' : 'Add a part'}</Link>
          <Link className="btn" to="/cartons">{cartons.length ? '✓ Cartons added' : 'Add a carton'}</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">New load plan</p><h1 className="h1">Plan an order</h1></div>
      </div>
      <div className="row">
        <div className="main-col">
          <section className="card">
            <div className="card-head">
              <h2><span className="step-no">1</span>Order lines</h2>
              {can('mixedOrders')
                ? <button className="btn" onClick={() => setLines([...lines, { partId: parts.find((p) => !lines.some((l) => l.partId === p._id))?._id || parts[0]._id, qty: 100 }])}><Plus />Add part</button>
                : <span className="muted" style={{ fontSize: 13 }}>Orders with several parts: Business plan</span>}
            </div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 640 }}>
                <thead><tr><th>Part</th><th>Box size (mm)</th><th>Weight</th><th>Upright</th><th>Quantity</th><th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const p = partById[l.partId];
                    return (
                      <tr key={i}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
                            <label htmlFor={`lp${i}`} className="sr-only">Part</label>
                            <select id={`lp${i}`} className="input" style={{ minWidth: 160 }} value={l.partId} onChange={(e) => setLine(i, { partId: e.target.value })}>
                              {parts.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                            </select>
                          </span>
                          {p && <span className="muted" style={{ fontSize: 12 }}>{partSummary(p)}</span>}
                        </td>
                        <td className="mono">{p && dims(p.box.l, p.box.w, p.box.h)}</td>
                        <td className="mono">{p && `${num(p.weightKg, 3)} kg`}</td>
                        <td>{p?.upright ? <span className="badge badge-blue">This side up</span> : <span className="muted">Any way</span>}</td>
                        <td>
                          <label htmlFor={`lq${i}`} className="sr-only">Quantity</label>
                          <input id={`lq${i}`} className="input num" style={{ width: 120, textAlign: 'right' }} inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d]/g, '') })} />
                        </td>
                        <td>{lines.length > 1 && <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">Remove</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2><span className="step-no">2</span>Cartons to compare</h2>
              <Link className="btn btn-blue" to="/cartons"><Star />Suggest cartons</Link>
            </div>
            <div className="grid-auto">
              {cartons.map((c) => (
                <label key={c._id} className={`choice${c.isSuggested ? ' suggested' : ''}`}>
                  <input type="checkbox" checked={cartonIds.includes(c._id)} onChange={() => toggleCarton(c._id)} />
                  <span>
                    <span className="t">{c.name}</span>
                    <span className="s">{dims(c.innerL, c.innerW, c.innerH)} · {inr(c.price)}</span>
                    <span className="x" style={c.isSuggested ? { color: 'var(--blue)', fontWeight: 500 } : undefined}>{c.isSuggested ? 'Suggested' : 'On hand'}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Inside sizes in mm. Each part gets the best carton from the ones you tick.</p>
          </section>

          <section className="card">
            <h2 style={{ marginBottom: 16 }}><span className="step-no">3</span>Pallet &amp; container</h2>
            <p className="section-label">Pallet</p>
            <div className="grid-auto" style={{ marginBottom: 20 }}>
              {pallets.map((p) => (
                <label key={p._id} className={`choice${palletId === p._id ? ' selected' : ''}`}>
                  <input type="radio" name="pallet" checked={palletId === p._id} onChange={() => setPalletId(p._id)} />
                  <span><span className="t">{p.name}</span><span className="s">{num(p.L)} × {num(p.W)}</span><span className="x">Max {num(p.maxLoadKg)} kg · {num(p.maxStackH)} mm high</span></span>
                </label>
              ))}
              <label className={`choice${palletId === 'floor' ? ' selected' : ''}`}>
                <input type="radio" name="pallet" checked={palletId === 'floor'} onChange={() => setPalletId('floor')} />
                <span><span className="t">No pallet</span><span className="x">Floor-load cartons</span></span>
              </label>
            </div>
            <p className="section-label">Container</p>
            <div className="grid-auto">
              {containers.map((c) => (
                <label key={c._id} className={`choice${containerId === c._id ? ' selected' : ''}`}>
                  <input type="radio" name="container" checked={containerId === c._id} onChange={() => pickContainer(c)} />
                  <span><span className="t">{c.name}</span><span className="s">{num(c.innerL)} × {num(c.innerW)} × {num(c.innerH)}</span><span className="x">Payload {num(c.payloadKg)} kg</span></span>
                </label>
              ))}
              <div className="field">
                <label htmlFor="freight" style={{ fontSize: 13 }} className="muted">Freight per container (₹)</label>
                <input id="freight" className="input num" inputMode="numeric" value={freightCost} onChange={(e) => setFreightCost(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginBottom: 4 }}><span className="step-no">4</span>What does “best” mean for this order?</h2>
            <p className="muted" style={{ margin: '0 0 16px 36px', fontSize: 14 }}>You can switch this on the result screen too.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {GOALS.map((g) => (
                <button key={g.id} type="button" aria-pressed={goal === g.id} className={`choice${goal === g.id ? ' selected' : ''}`} onClick={() => setGoal(g.id)}>
                  <span className="t">{g.name}</span><span className="x" style={{ fontSize: 13 }}>{g.desc}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-col card-dark" aria-label="Plan summary" style={{ gap: 0 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Plan summary</h2>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 16px', fontSize: 14 }}>
            <dt style={{ color: 'var(--dark-muted)' }}>Order</dt><dd style={{ margin: 0, textAlign: 'right' }}>{lines.length} part{lines.length > 1 ? 's' : ''} · {num(totalQty)} pcs</dd>
            <dt style={{ color: 'var(--dark-muted)' }}>Cartons</dt><dd style={{ margin: 0, textAlign: 'right' }}>{cartonIds.length} to compare</dd>
            <dt style={{ color: 'var(--dark-muted)' }}>Pallet</dt><dd style={{ margin: 0, textAlign: 'right' }}>{palletId === 'floor' ? 'No pallet' : pallet?.name}</dd>
            <dt style={{ color: 'var(--dark-muted)' }}>Container</dt><dd style={{ margin: 0, textAlign: 'right' }}>{container?.name}</dd>
            <dt style={{ color: 'var(--dark-muted)' }}>Goal</dt><dd style={{ margin: 0, textAlign: 'right', color: '#F7A26B', fontWeight: 600 }}>{GOALS.find((g) => g.id === goal).name}</dd>
          </dl>
          <div style={{ height: 1, background: '#343A42', margin: '20px 0' }} />
          {error && <div style={{ marginBottom: 12 }}><ErrorNotice error={error} /></div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={!ready || busy} onClick={calculate}>
            {busy ? 'Calculating…' : <>Calculate plan<Arrow /></>}
          </button>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--dark-muted)' }}>A calculated plan. Confirm on site before loading.</p>
        </aside>
      </div>
    </>
  );
}
