// Running Jobs (Phase 3): every calculation of this account that is queued or running,
// plus what finished in the last 24 hours. Refreshes every 2 seconds while something is active.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { StatusBadge, PRESETS } from './part/RunSections.jsx';

const secs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);

export default function Jobs() {
  const { session } = useAuth();
  const canEdit = session.user.role !== 'viewer';
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/runs/jobs').then(setJobs).catch(setError);
  const active = (jobs || []).filter((j) => j.status === 'queued' || j.status === 'running');

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, active.length ? 2000 : 10000);
    return () => clearInterval(t);
  }, [active.length]);

  const cancel = async (j) => { try { await api.post(`/runs/${j._id}/cancel`); load(); } catch (e) { setError(e); } };

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">Background calculations</p><h1 className="h1">Running jobs</h1></div>
        <span className="muted">{active.length} active · refreshes automatically</span>
      </div>
      <ErrorNotice error={error} />
      <section className="card">
        {!jobs ? <p className="muted">Loading…</p> : !jobs.length ? <p className="muted" style={{ margin: 0 }}>No calculations in the last 24 hours. Start one from a part's section 1.</p> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 820 }}>
              <thead><tr><th>Run</th><th>Part</th><th>Preset</th><th>Status</th><th style={{ width: 220 }}>Progress</th><th>Started</th><th className="r">Time</th><th /></tr></thead>
              <tbody>{jobs.map((j) => {
                const live = j.status === 'queued' || j.status === 'running';
                const time = j.status === 'done' ? j.durationMs : j.startedAt ? (j.finishedAt ? new Date(j.finishedAt) : Date.now()) - new Date(j.startedAt) : null;
                return (
                  <tr key={j._id}>
                    <td className="mono"><b>{j.number}</b></td>
                    <td>{j.projectId ? <Link to={`/projects/${j.projectId}/parts/${j.partId}`}>{j.partName}</Link> : j.partName}</td>
                    <td className="muted">{PRESETS[j.preset]?.short || j.preset}</td>
                    <td>{j.status === 'done' ? <span className="badge badge-green">done</span> : <StatusBadge status={j.status} />}</td>
                    <td>
                      {live ? <>
                        <div className="progress"><div style={{ width: `${j.progress?.pct || 0}%`, background: 'var(--blue)' }} /></div>
                        <span className="muted" style={{ fontSize: 12 }}>{j.progress?.pct || 0}% · {j.progress?.step}</span>
                      </> : j.status === 'failed' ? <span className="err" style={{ fontSize: 13 }}>{j.error}</span> : <span className="muted" style={{ fontSize: 13 }}>{j.progress?.step}</span>}
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{new Date(j.startedAt || j.createdAt).toLocaleTimeString()}</td>
                    <td className="mono r">{secs(time)}</td>
                    <td className="r">{live && canEdit && <button className="btn btn-ghost" style={{ minHeight: 34, padding: '0 10px' }} onClick={() => cancel(j)}>Cancel</button>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
