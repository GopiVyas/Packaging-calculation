import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { GOALS, num } from '../format.js';

export default function Plans() {
  const { session } = useAuth();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/plans').then(setPlans).catch(setError);
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(`Delete plan "${p.name}"?`)) return;
    try { await api.del(`/plans/${p._id}`); load(); } catch (e) { setError(e); }
  };

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">History</p><h1 className="h1">Saved plans</h1></div>
        <Link className="btn btn-primary" to="/planner">New plan</Link>
      </div>
      <ErrorNotice error={error} />
      <section className="card">
        {!plans ? <p className="muted">Loading…</p> : !plans.length ? <p className="muted" style={{ margin: 0 }}>No saved plans yet. Calculate a plan and save it to see it here.</p> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 600 }}>
              <thead><tr><th>Plan</th><th>Goal</th><th className="r">Order lines</th><th className="r">Pieces</th><th>Saved</th><th /></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p._id}>
                    <td><Link to={`/plans/${p._id}`}><b>{p.name}</b></Link> {p.shareToken && <span className="badge badge-blue">Phone link on</span>}</td>
                    <td>{GOALS.find((g) => g.id === p.goal)?.name}</td>
                    <td className="mono r">{p.inputs?.lines?.length}</td>
                    <td className="mono r">{num(p.inputs?.lines?.reduce((a, l) => a + l.qty, 0))}</td>
                    <td className="muted">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="r">{session.user.role !== 'viewer' && <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => remove(p)}>Delete</button>}</td>
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
