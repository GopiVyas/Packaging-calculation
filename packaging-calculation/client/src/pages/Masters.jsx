import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { Plus } from '../components/Icons.jsx';
import { inr, num } from '../format.js';

const PALLET = {
  path: '/pallets', title: 'Pallets', single: 'pallet',
  fields: [['L', 'Length (mm)'], ['W', 'Width (mm)'], ['deckH', 'Deck height (mm)'], ['maxStackH', 'Max total height (mm)'], ['maxLoadKg', 'Max load (kg)'], ['weightKg', 'Pallet weight (kg)']],
  empty: { name: '', L: 1200, W: 1000, deckH: 150, maxStackH: 1800, maxLoadKg: 1000, weightKg: 25 },
  cols: [['Size', (p) => `${num(p.L)} × ${num(p.W)}`], ['Max height', (p) => `${num(p.maxStackH)} mm`], ['Max load', (p) => `${num(p.maxLoadKg)} kg`]]
};
const MATERIAL = {
  path: '/materials', title: 'Materials', single: 'material',
  fields: [['densityGcm3', 'Density (g/cm³)']],
  empty: { name: '', densityGcm3: 1.0 },
  cols: [['Density', (m) => `${m.densityGcm3} g/cm³`]]
};
const CONTAINER = {
  path: '/containers', title: 'Containers', single: 'container',
  fields: [['innerL', 'Inside length (mm)'], ['innerW', 'Inside width (mm)'], ['innerH', 'Inside height (mm)'], ['payloadKg', 'Payload (kg)'], ['freightCost', 'Freight per container (₹)']],
  empty: { name: '', innerL: 5898, innerW: 2352, innerH: 2393, payloadKg: 28200, freightCost: 120000 },
  cols: [['Inside', (c) => `${num(c.innerL)} × ${num(c.innerW)} × ${num(c.innerH)}`], ['Payload', (c) => `${num(c.payloadKg)} kg`], ['Freight', (c) => inr(c.freightCost)]]
};

function MasterList({ cfg, canEdit }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get(cfg.path).then(setRows).catch(setError);
  useEffect(() => { load(); }, []);

  const run = async (fn) => { setError(null); try { await fn(); load(); } catch (e) { setError(e); } };
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k === 'name' ? v : Number(v)]));
      if (editId) await api.put(`${cfg.path}/${editId}`, body); else await api.post(cfg.path, body);
      setForm(null); setEditId(null);
    });
  };

  return (
    <section className="card" aria-labelledby={cfg.path}>
      <div className="card-head">
        <h2 id={cfg.path}>{cfg.title}</h2>
        {canEdit && <button className="btn" onClick={() => { setForm(cfg.empty); setEditId(null); }}><Plus />Add {cfg.single}</button>}
      </div>
      {form && (
        <form className="stack" style={{ marginBottom: 20, padding: 16, background: '#F7F6F2', borderRadius: 10 }} onSubmit={save}>
          <div className="grid-fit">
            <div className="field"><label htmlFor={`${cfg.path}-name`}>Name</label><input id={`${cfg.path}-name`} className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            {cfg.fields.map(([k, label]) => (
              <div className="field" key={k}><label htmlFor={`${cfg.path}-${k}`}>{label}</label><input id={`${cfg.path}-${k}`} className="input num" inputMode="decimal" required value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="inline"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <ErrorNotice error={error} />
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 620 }}>
          <thead><tr><th>Name</th>{cfg.cols.map(([h]) => <th key={h}>{h}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td><b>{r.name}</b> {r.isTemplate ? <span className="badge badge-grey">Standard</span> : <span className="badge badge-blue">Yours</span>}</td>
                {cfg.cols.map(([h, fn]) => <td key={h} className="mono">{fn(r)}</td>)}
                <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  {canEdit && (r.canEdit ? <>
                    <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => { setEditId(r._id); setForm(Object.fromEntries(['name', ...cfg.fields.map((f) => f[0])].map((k) => [k, r[k]]))); }}>Edit</button>{' '}
                    <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => window.confirm(`Delete ${r.name}?`) && run(() => api.del(`${cfg.path}/${r._id}`))}>Delete</button>
                  </> : <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => run(() => api.post(`${cfg.path}/${r._id}/copy`))}>Copy to edit</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Masters() {
  const { session } = useAuth();
  const canEdit = session.user.role !== 'viewer';
  return (
    <>
      <div className="page-head"><div><p className="eyebrow">Saved data</p><h1 className="h1">Pallets, containers &amp; materials</h1></div></div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>Standard sizes are shared by everyone and cannot be changed. Copy one to make your own version.</p>
      <div className="stack" style={{ gap: 24 }}>
        <MasterList cfg={PALLET} canEdit={canEdit} />
        <MasterList cfg={CONTAINER} canEdit={canEdit} />
        <MasterList cfg={MATERIAL} canEdit={canEdit} />
      </div>
    </>
  );
}
