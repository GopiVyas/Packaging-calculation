import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { Plus } from '../components/Icons.jsx';

const ROLE_TEXT = { owner: 'Owner · everything incl. billing and team', planner: 'Planner · parts, cartons and plans', viewer: 'Viewer · opens plans only' };

export default function Team() {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/users').then(setUsers).catch(setError);
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setError(null); try { await fn(); load(); } catch (e) { setError(e); } };
  const limit = session.entitlements.limits.users;

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">{session.org.name}</p><h1 className="h1">Team</h1></div>
        <button className="btn" onClick={() => setForm({ name: '', email: '', role: 'planner', password: '' })}><Plus />Add user</button>
      </div>
      <p className="muted" style={{ marginTop: -12 }}>{users.length} of {limit ?? 'unlimited'} users on the {session.entitlements.label} plan.</p>
      {form && (
        <form className="card stack" style={{ marginBottom: 20 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/users', form); setForm(null); }); }}>
          <div className="grid-fit">
            <div className="field"><label htmlFor="un">Name</label><input id="un" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="ue">Email</label><input id="ue" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="ur">Role</label><select id="ur" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="planner">Planner</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select></div>
            <div className="field"><label htmlFor="up">Temporary password</label><input id="up" type="text" minLength={8} className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <div className="inline"><button className="btn btn-primary">Add user</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <ErrorNotice error={error} />
      <section className="card">
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 560 }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td><b>{u.name}</b></td>
                  <td>{u.email}</td>
                  <td>
                    {u._id === session.user.id ? ROLE_TEXT[u.role] : (
                      <><label htmlFor={`r${u._id}`} className="sr-only">Role for {u.name}</label>
                        <select id={`r${u._id}`} className="input" value={u.role} onChange={(e) => run(() => api.patch(`/users/${u._id}`, { role: e.target.value }))}>
                          {Object.keys(ROLE_TEXT).map((r) => <option key={r} value={r}>{ROLE_TEXT[r]}</option>)}
                        </select></>
                    )}
                  </td>
                  <td className="r">{u._id !== session.user.id && <button className="btn btn-danger" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => window.confirm(`Remove ${u.name}?`) && run(() => api.del(`/users/${u._id}`))}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
