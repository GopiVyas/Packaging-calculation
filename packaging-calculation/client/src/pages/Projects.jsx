import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { Plus } from '../components/Icons.jsx';

export default function Projects() {
  const { t } = useI18n();
  const [projects, setProjects] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/projects').then(setProjects).catch(setError);
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try { await api.post('/projects', form); setForm(null); load(); } catch (err) { setError(err); }
  };

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">Workspace</p><h1 className="h1">{t('projects')}</h1></div>
        <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '' })}><Plus />{t('newProject')}</button>
      </div>
      {form && (
        <form className="card stack" style={{ marginBottom: 20 }} onSubmit={create}>
          <div className="grid-fit">
            <div className="field"><label htmlFor="pjn">Project name</label><input id="pjn" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="pjd">Description</label><input id="pjd" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="inline"><button className="btn btn-primary">Create project</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <ErrorNotice error={error} />
      {!projects ? <p className="muted">Loading…</p> : !projects.length ? (
        <section className="card"><p className="muted" style={{ margin: 0 }}>No projects yet. A project groups the parts of one product line or order.</p></section>
      ) : (
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map((p) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="card project-card">
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{p.name}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{p.description || '—'}</p>
              <p className="mono muted" style={{ margin: '12px 0 0', fontSize: 12 }}>Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
