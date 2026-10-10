import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, useCan } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { CartonPic } from '../components/Pictures.jsx';
import { Check, Plus, Star } from '../components/Icons.jsx';
import { dims, inr, num } from '../format.js';

const EMPTY = { name: '', innerL: '', innerW: '', innerH: '', wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.5, price: '' };
const FIELDS = [
  ['innerL', 'Inside length (mm)'], ['innerW', 'Inside width (mm)'], ['innerH', 'Inside height (mm)'], ['wallMm', 'Wall (mm)'],
  ['maxWeightKg', 'Holds up to (kg)'], ['emptyWeightKg', 'Empty weight (kg)'], ['price', 'Price (₹)']
];

export default function Cartons() {
  const { session } = useAuth();
  const can = useCan();
  const canEdit = session.user.role !== 'viewer';
  const [cartons, setCartons] = useState([]);
  const [parts, setParts] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [containers, setContainers] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [sug, setSug] = useState({ partId: '', palletId: '', containerId: '', qty: 1000, maxL: 700, maxW: 500, maxH: 500, maxGrossKg: 25, wallMm: 5 });
  const [suggestions, setSuggestions] = useState(null);
  const [sugError, setSugError] = useState(null);
  const [added, setAdded] = useState({});

  const load = () => api.get('/cartons').then(setCartons).catch(setError);
  useEffect(() => {
    load();
    Promise.all([api.get('/parts'), api.get('/pallets'), api.get('/containers')]).then(([p, pl, c]) => {
      setParts(p); setPallets(pl); setContainers(c);
      setSug((s) => ({ ...s, partId: p[0]?._id || '', palletId: pl[0]?._id || 'floor', containerId: c[0]?._id || '' }));
    }).catch(setError);
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k === 'name' ? v : Number(v)]));
      if (editId) await api.put(`/cartons/${editId}`, body);
      else await api.post('/cartons', body);
      setForm(null); setEditId(null); load();
    } catch (err) { setError(err); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try { await api.del(`/cartons/${c._id}`); load(); } catch (err) { setError(err); }
  };

  const suggest = async () => {
    setSugError(null);
    setSuggestions(null);
    try {
      const r = await api.post('/cartons/suggest', {
        partId: sug.partId, palletId: sug.palletId, containerId: sug.containerId, qty: Number(sug.qty),
        constraints: { maxOuter: [Number(sug.maxL), Number(sug.maxW), Number(sug.maxH)], maxGrossKg: Number(sug.maxGrossKg), wallMm: Number(sug.wallMm) }
      });
      setSuggestions(r.suggestions);
      setAdded({});
    } catch (err) { setSugError(err); }
  };

  const addSuggested = async (s, i) => {
    try {
      const { _id, ...c } = s.carton;
      const name = `S${cartons.filter((x) => x.isSuggested).length + 1} · ${c.innerL}×${c.innerW}×${c.innerH}`;
      await api.post('/cartons', { ...c, name, isSuggested: true });
      setAdded({ ...added, [i]: true });
      load();
    } catch (err) { setSugError(err); }
  };

  const partColor = '#2F6DB5';

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">Saved data</p><h1 className="h1">Cartons</h1></div>
        {canEdit && <button className="btn" onClick={() => { setForm(EMPTY); setEditId(null); }}><Plus />Add carton</button>}
      </div>

      {form && (
        <form className="card stack" style={{ marginBottom: 24 }} onSubmit={save}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{editId ? 'Edit carton' : 'Add carton'}</h2>
          <div className="grid-fit">
            <div className="field"><label htmlFor="cn">Name</label><input id="cn" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            {FIELDS.map(([k, label]) => (
              <div className="field" key={k}><label htmlFor={k}>{label}</label><input id={k} className="input num" inputMode="decimal" required value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
          </div>
          <ErrorNotice error={error} />
          <div className="inline"><button className="btn btn-primary">Save carton</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      <section className="card" style={{ marginBottom: 24 }} aria-labelledby="onhand">
        <h2 id="onhand" style={{ marginBottom: 16 }}>Your cartons</h2>
        {!form && <ErrorNotice error={error} />}
        {!cartons.length ? <p className="muted">No cartons yet. Add the cartons you have, or ask for suggestions below.</p> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 760 }}>
              <thead><tr><th>Carton</th><th>Inside (mm)</th><th>Outside (mm)</th><th className="r">Holds up to</th><th className="r">Empty</th><th className="r">Price</th><th /></tr></thead>
              <tbody>
                {cartons.map((c) => (
                  <tr key={c._id}>
                    <td><b>{c.name}</b> {c.isSuggested && <span className="badge badge-blue">Suggested</span>}</td>
                    <td className="mono">{dims(c.innerL, c.innerW, c.innerH)}</td>
                    <td className="mono muted">{dims(c.innerL + 2 * c.wallMm, c.innerW + 2 * c.wallMm, c.innerH + 2 * c.wallMm)}</td>
                    <td className="mono r">{num(c.maxWeightKg, 1)} kg</td>
                    <td className="mono r">{num(c.emptyWeightKg, 2)} kg</td>
                    <td className="mono r">{inr(c.price)}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {canEdit && <>
                        <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => { setEditId(c._id); setForm(Object.fromEntries(['name', ...FIELDS.map((f) => f[0])].map((k) => [k, c[k]]))); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>{' '}
                        <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => remove(c)}>Delete</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ border: '2px solid var(--blue)' }} aria-labelledby="suggest">
        <div className="card-head">
          <div>
            <h2 id="suggest" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}><span style={{ color: 'var(--blue)' }}><Star /></span>Suggested cartons</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Sizes built around the part, then checked against the pallet and container.</p>
          </div>
          {can('suggest') && canEdit && <button className="btn btn-blue" style={{ background: 'var(--blue)', color: '#fff' }} onClick={suggest} disabled={!sug.partId || !sug.containerId}>Suggest cartons</button>}
        </div>

        {!can('suggest') ? (
          <ErrorNotice error={{ isUpgrade: true, message: `Carton suggestions are included in Pro and above. You are on ${session.entitlements.label}.` }} />
        ) : (
          <>
            <div className="grid-fit" style={{ marginBottom: 20 }}>
              <div className="field"><label htmlFor="sp">Part</label>
                <select id="sp" className="input" value={sug.partId} onChange={(e) => setSug({ ...sug, partId: e.target.value })}>
                  {parts.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select></div>
              <div className="field"><label htmlFor="spal">Fit to pallet</label>
                <select id="spal" className="input" value={sug.palletId} onChange={(e) => setSug({ ...sug, palletId: e.target.value })}>
                  {pallets.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  <option value="floor">No pallet (floor load)</option>
                </select></div>
              <div className="field"><label htmlFor="scon">Container</label>
                <select id="scon" className="input" value={sug.containerId} onChange={(e) => setSug({ ...sug, containerId: e.target.value })}>
                  {containers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select></div>
              <div className="field"><label htmlFor="sq">Order quantity</label><input id="sq" className="input num" inputMode="numeric" value={sug.qty} onChange={(e) => setSug({ ...sug, qty: e.target.value })} /></div>
              <div className="field"><span className="label">Largest outside size (mm)</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['maxL', 'maxW', 'maxH'].map((k, i) => (
                    <input key={k} aria-label={['Longest side', 'Other side', 'Height'][i]} className="input num" style={{ padding: '0 8px' }} value={sug[k]} onChange={(e) => setSug({ ...sug, [k]: e.target.value })} />
                  ))}
                </div></div>
              <div className="field"><label htmlFor="sg">Max carton weight (kg)</label><input id="sg" className="input num" value={sug.maxGrossKg} onChange={(e) => setSug({ ...sug, maxGrossKg: e.target.value })} /></div>
              <div className="field"><label htmlFor="sw">Wall (mm)</label><input id="sw" className="input num" value={sug.wallMm} onChange={(e) => setSug({ ...sug, wallMm: e.target.value })} /></div>
            </div>
            <ErrorNotice error={sugError} />
            {suggestions && !suggestions.length && <p className="muted">No carton fits these limits. Try a larger size or weight limit.</p>}
            {suggestions && suggestions.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {suggestions.map((s, i) => (
                  <article key={s.carton._id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 17 }}>Option {i + 1}</h3>
                      <span className="inline" style={{ gap: 4 }}>{s.reasons.map((r) => <span key={r} className={`badge ${r === 'Lowest cost' ? 'badge-orange' : r === 'Best pallet fit' ? 'badge-green' : 'badge-blue'}`}>{r}</span>)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#F7F6F2', borderRadius: 8, padding: 16, minHeight: 176 }}>
                      <CartonPic option={s.plan} color={partColor} max={140} />
                      <div><p className="mono" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{s.plan.perCarton} parts</p><p className="muted" style={{ margin: 0 }}>{s.plan.grid.nx} × {s.plan.grid.ny} × {s.plan.grid.nz} layers</p></div>
                    </div>
                    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 14 }}>
                      <dt className="muted">Inside</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>{dims(s.carton.innerL, s.carton.innerW, s.carton.innerH)}</dd>
                      <dt className="muted">Outside</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>{dims(s.plan.outer.l, s.plan.outer.w, s.plan.outer.h)}</dd>
                      <dt className="muted">Full weight</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>{num(s.plan.grossKg, 1)} kg</dd>
                      <dt className="muted">Per pallet</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>{s.plan.perLayer} × {s.plan.layers} = {s.plan.perPallet} ({num(s.plan.partsPerPallet)} parts)</dd>
                      <dt className="muted">Containers</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>{s.plan.containers}</dd>
                      <dt className="muted">Est. price</dt><dd className="mono" style={{ margin: 0, textAlign: 'right' }}>~{inr(s.carton.price)}</dd>
                    </dl>
                    {added[i]
                      ? <button className="btn" style={{ marginTop: 'auto', background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'transparent' }} disabled><Check />Added to your cartons</button>
                      : <button className="btn" style={{ marginTop: 'auto' }} onClick={() => addSuggested(s, i)}><Plus />Add to my cartons</button>}
                  </article>
                ))}
              </div>
            )}
            <p className="muted" style={{ margin: '16px 0 0', fontSize: 13 }}>Price is an estimate from board area. Replace it with your supplier's quote after adding the carton.</p>
          </>
        )}
      </section>
    </>
  );
}
