import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { Plus } from '../components/Icons.jsx';
import { dims, num, partSummary } from '../format.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const nav = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [up, setUp] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/projects/${id}/parts`).then(setData).catch(setError); }, [id]);
  useEffect(() => { api.get('/materials').then(setMaterials).catch(() => {}); }, []);

  const uploadPart = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', up.file);
      if (up.name) fd.append('name', up.name);
      if (up.mode === 'material') fd.append('materialId', up.materialId); else fd.append('weightG', up.weightG);
      fd.append('upright', String(up.upright));
      const part = await api.upload(`/projects/${id}/parts/cad`, fd);
      nav(`/projects/${id}/parts/${part._id}`);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  if (!data) return error ? <ErrorNotice error={error} /> : <p className="muted">Loading…</p>;
  const { project, parts } = data;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/projects">{t('projects')}</Link> / <span>{project.name}</span></nav>
      <div className="page-head">
        <div><h1 className="h1">{project.name}</h1><p className="muted" style={{ margin: '4px 0 0' }}>{project.description}</p></div>
        <div className="inline">
          <button className="btn btn-primary" onClick={() => setUp({ file: null, name: '', mode: 'material', materialId: '', weightG: '', upright: false })}><Plus />Upload STEP</button>
          <Link className="btn" to={`/parts?project=${project._id}`}>Enter sizes by hand</Link>
        </div>
      </div>
      {up && (
        <form className="card stack" style={{ marginBottom: 20 }} onSubmit={uploadPart}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New part from a CAD file</h2>
          <div className="grid-fit">
            <div className="field"><label htmlFor="uf">STEP or STL file</label>
              <input id="uf" type="file" className="input" style={{ paddingTop: 9 }} accept=".step,.stp,.stl" required onChange={(e) => setUp({ ...up, file: e.target.files[0] })} /></div>
            <div className="field"><label htmlFor="un">Name (optional)</label><input id="un" className="input" placeholder="File name is used if empty" value={up.name} onChange={(e) => setUp({ ...up, name: e.target.value })} /></div>
          </div>
          <fieldset className="fs"><legend>Weight</legend>
            <div className="inline">
              <label className="chip"><input type="radio" name="wm" checked={up.mode === 'material'} onChange={() => setUp({ ...up, mode: 'material' })} />From material (volume × density)</label>
              <label className="chip"><input type="radio" name="wm" checked={up.mode === 'manual'} onChange={() => setUp({ ...up, mode: 'manual' })} />Enter weight</label>
            </div>
          </fieldset>
          <div className="grid-fit">
            {up.mode === 'material' ? (
              <div className="field"><label htmlFor="um">Material</label>
                <select id="um" className="input" required value={up.materialId} onChange={(e) => setUp({ ...up, materialId: e.target.value })}>
                  <option value="">Choose…</option>
                  {materials.map((m) => <option key={m._id} value={m._id}>{m.name} · {m.densityGcm3} g/cm³</option>)}
                </select></div>
            ) : (
              <div className="field"><label htmlFor="uw">Weight per part (g)</label><input id="uw" className="input num" inputMode="decimal" required value={up.weightG} onChange={(e) => setUp({ ...up, weightG: e.target.value })} /></div>
            )}
          </div>
          <label className="inline" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={up.upright} onChange={(e) => setUp({ ...up, upright: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />Must stay upright (this side up)</label>
          <div className="inline">
            <button className="btn btn-primary" disabled={busy || !up.file}>{busy ? 'Reading the file…' : 'Upload and analyse'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setUp(null)}>Cancel</button>
          </div>
        </form>
      )}
      <section className="card">
        {!parts.length ? <p className="muted" style={{ margin: 0 }}>No parts in this project yet.</p> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 640 }}>
              <thead><tr><th>Part</th><th>Shape</th><th>Box size (mm)</th><th className="r">Weight</th><th>Status</th></tr></thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p._id}>
                    <td><Link to={`/projects/${project._id}/parts/${p._id}`}><b>{p.name}</b></Link></td>
                    <td className="muted">{p.shape === 'cad' ? `${p.cad?.format} · ${p.cad?.fileName}` : partSummary(p)}</td>
                    <td className="mono">{dims(p.box.l, p.box.w, p.box.h)}</td>
                    <td className="mono r">{num(p.weightKg * 1000, 1)} g</td>
                    <td><span className="badge badge-grey">Not calculated</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
