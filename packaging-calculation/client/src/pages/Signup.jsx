import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo } from '../components/Icons.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(form);
      nav('/parts', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <div className="brand" style={{ color: 'var(--ink)' }}><Logo />Packaging Solution</div>
        <h1 className="h1" style={{ fontSize: 26 }}>Start your free trial</h1>
        <p className="muted" style={{ margin: 0 }}>14 days of Pro. No card needed.</p>
        <div className="field"><label htmlFor="org">Company name</label><input id="org" className="input" required value={form.orgName} onChange={set('orgName')} /></div>
        <div className="field"><label htmlFor="name">Your name</label><input id="name" className="input" autoComplete="name" required value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="email">Work email</label><input id="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="pw">Password (8+ characters)</label><input id="pw" className="input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} /></div>
        <ErrorNotice error={error} />
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="muted" style={{ margin: 0 }}>Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
