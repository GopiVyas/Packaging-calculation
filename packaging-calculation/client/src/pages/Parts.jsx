import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { ShapeIcon } from '../components/Icons.jsx';
import { FIELD_LABELS, SHAPE_FIELDS, SHAPE_HINTS, SHAPE_LABELS, num, partSummary } from '../format.js';

const EMPTY = { projectId: '', name: '', shape: 'box', dims: {}, unit: 'mm', weight: '', weightUnit: 'kg', clearanceMm: 0, upright: false };
const TO_MM = { mm: 1, cm: 10, in: 25.4 };

// Same rule as the server engine (shapes.js), so the user sees the box size while typing.
function previewBox(f) {
  const v = SHAPE_FIELDS[f.shape].map((k) => Number(f.dims[k]) * TO_MM[f.unit]);
  if (v.some((x) => !(x > 0))) return null;
  const c = 2 * (Number(f.clearanceMm) || 0);
  const [l, w, h] = f.shape === 'square' ? [v[0], v[0], v[1]] : f.shape === 'circle' ? [v[0], v[0], v[1]] : v;
  return [l + c, w + c, h + c];
}

export default function Parts() {
  const { session } = useAuth();
  const canEdit = session.user.role !== 'viewer';
  const [params] = useSearchParams();
  const fromProject = params.get('project');
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, projectId: fromProject || '' });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/parts').then(setParts).catch(setError);
  useEffect(() => { load(); api.get('/projects').then(setProjects).catch(() => {}); }, []);

  const box = previewBox(form);
  const filtered = useMemo(() => parts.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [parts, q]);
  const setDim = (k, v) => setForm({ ...form, dims: { ...form.dims, [k]: v } });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        projectId: form.projectId || null,
        dims: Object.fromEntries(SHAPE_FIELDS[form.shape].map((k) => [k, Number(form.dims[k])])),
        weight: Number(form.weight),
        clearanceMm: Number(form.clearanceMm) || 0
      };
      if (editId) await api.put(`/parts/${editId}`, body);
      else await api.post('/parts', body);
      if (fromProject && !editId) return navigate(`/projects/${fromProject}`);
      setForm({ ...EMPTY, projectId: form.projectId });
      setEditId(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({ projectId: p.projectId || '', name: p.name, shape: p.shape, dims: { ...p.dims }, unit: p.unit, weight: p.weight, weightUnit: p.weightUnit, clearanceMm: p.clearanceMm, upright: p.upright });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try { await api.del(`/parts/${p._id}`); load(); } catch (err) { setError(err); }
  };

  return (
    <>
      <div className="page-head"><div><p className="eyebrow">Saved data</p><h1 className="h1">Parts</h1></div></div>
      <div className="row">
        {canEdit && (
          <form className="card main-col" style={{ gap: 20 }} onSubmit={save}>
            <h2 style={{ fontSize: 20, margin: 0 }}>{editId ? 'Edit part' : 'Add a part'}</h2>
            <div className="inline" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '2 1 240px' }}>
                <label htmlFor="pname">Part name</label>
                <input id="pname" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="proj">Project</label>
                <select id="proj" className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">— none —</option>
                  {projects.map((pj) => <option key={pj._id} value={pj._id}>{pj.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 120px' }}>
                <label htmlFor="unit">Size unit</label>
                <select id="unit" className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="mm">mm</option><option value="cm">cm</option><option value="in">inch</option>
                </select>
              </div>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, padding: 0 }}>Shape</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
                {Object.keys(SHAPE_FIELDS).map((s) => (
                  <button type="button" key={s} aria-pressed={form.shape === s} className={`choice${form.shape === s ? ' selected' : ''}`}
                    style={{ alignItems: 'center', minHeight: 96, justifyContent: 'center' }}
                    onClick={() => setForm({ ...form, shape: s })}>
                    <ShapeIcon shape={s} />{SHAPE_LABELS[s]}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="muted" style={{ margin: 0 }}>{SHAPE_HINTS[form.shape]}</p>
            <div className="grid-fit">
              {SHAPE_FIELDS[form.shape].map((k) => (
                <div className="field" key={form.shape + k}>
                  <label htmlFor={`d-${k}`}>{FIELD_LABELS[k]} ({form.unit})</label>
                  <input id={`d-${k}`} className="input num" inputMode="decimal" required value={form.dims[k] ?? ''} onChange={(e) => setDim(k, e.target.value)} />
                </div>
              ))}
            </div>

            <div className="inline" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="wt">Weight per part</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="wt" className="input num" inputMode="decimal" required value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                  <label htmlFor="wu" className="sr-only">Weight unit</label>
                  <select id="wu" className="input" style={{ width: 80 }} value={form.weightUnit} onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}>
                    <option value="kg">kg</option><option value="lb">lb</option>
                  </select>
                </div>
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="clr">Clearance per side (mm)</label>
                <input id="clr" className="input num" inputMode="decimal" value={form.clearanceMm} onChange={(e) => setForm({ ...form, clearanceMm: e.target.value })} />
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={form.upright} onChange={(e) => setForm({ ...form, upright: e.target.checked })} />
              <span><b style={{ display: 'block' }}>Must stay upright (this side up)</b><span className="muted" style={{ fontSize: 13 }}>The part can turn on the floor but is never laid on its side.</span></span>
            </label>

            <ErrorNotice error={error} />
            <div className="inline">
              <button className="btn btn-primary btn-lg" disabled={busy}>{editId ? 'Save changes' : 'Save part'}</button>
              {editId && <button type="button" className="btn btn-ghost btn-lg" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
            </div>
          </form>
        )}

        <div className="side-col">
          {canEdit && (
            <section className="card-dark" aria-labelledby="need">
              <h2 id="need" style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--dark-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Box size needed</h2>
              <p className="mono" style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#fff' }}>
                {box ? box.map((x) => num(x, 1)).join(' × ') : '— × — × —'}
                <span style={{ fontSize: 15, color: 'var(--dark-muted)', fontWeight: 400 }}> mm</span>
              </p>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--dark-muted)' }}>The engine packs this box. Round and odd shapes are not nested tighter in this version.</p>
            </section>
          )}

          <section className="card" aria-labelledby="saved">
            <div className="card-head" style={{ marginBottom: 12 }}><h2 id="saved">Saved parts</h2><span className="muted" style={{ fontSize: 13 }}>{parts.length} parts</span></div>
            <label htmlFor="ps" className="sr-only">Search parts</label>
            <input id="ps" type="search" className="input" placeholder="Search parts" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
            {!parts.length && <p className="muted">No parts yet. Add your first part to start planning.</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filtered.map((p) => (
                <li key={p._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span>
                    <b style={{ display: 'block' }}>{p.name} {p.upright && <span className="badge badge-blue">Upright</span>}</b>
                    <span className="mono muted" style={{ fontSize: 13 }}>{partSummary(p)} · {num(p.weight, 3)} {p.weightUnit}</span>
                  </span>
                  {canEdit && (
                    <span className="inline" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {p.shape !== 'cad' && <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => edit(p)}>Edit</button>}
                      <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>Delete</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
