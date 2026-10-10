import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo } from '../components/Icons.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      nav(loc.state?.from || '/', { replace: true });
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
        <h1 className="h1" style={{ fontSize: 26 }}>Log in</h1>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <ErrorNotice error={error} />
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ minHeight: 40 }}
          onClick={() => {
            setForm({ email: 'demo@packaging.local', password: 'demo1234' });
          }}
        >
          Fill Demo Account (demo@packaging.local)
        </button>
        <p className="muted" style={{ margin: 0 }}>New here? <Link to="/signup">Start a free 14-day trial</Link></p>
      </form>
    </div>
  );
}

