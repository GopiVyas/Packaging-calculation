import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Logo } from './Icons.jsx';

const MASTER = ['/parts', '/cartons', '/pallets-containers'];

export default function Layout({ children }) {
  const { session, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const { org, user, entitlements } = session;
  const trialDays = org.subscriptionStatus === 'trialing' && org.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt) - Date.now()) / 864e5))
    : null;
  const inMaster = MASTER.some((p) => loc.pathname.startsWith(p));

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/projects" className="brand"><Logo />Packaging Solution</Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/projects">{t('projects')}</NavLink>
            <NavLink to="/jobs">{t('jobs')}</NavLink>
            <NavLink to="/planner">Planner</NavLink>
            <NavLink to="/plans">{t('plans')}</NavLink>
            {user.role === 'owner' && <NavLink to="/team">{t('team')}</NavLink>}
          </nav>
          <div className="who">
            <NavLink to="/parts" className={`master-btn${inMaster ? ' on' : ''}`}>{t('masterData')}</NavLink>
            <div className="langs" role="group" aria-label="Language">
              {['en', 'de', 'zh'].map((l) => (
                <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <span className="pill-dark" title={org.name}>
              {entitlements.label}{trialDays !== null ? ` · trial ${trialDays}d` : ''}
            </span>
            <button className="linkbtn" onClick={async () => { await logout(); nav('/login'); }}>{t('logout')}</button>
          </div>
        </div>
      </header>
      {inMaster && (
        <div className="subnav">
          <div className="subnav-in">
            <NavLink to="/parts">Parts</NavLink>
            <NavLink to="/cartons">Cartons</NavLink>
            <NavLink to="/pallets-containers">Pallets &amp; containers</NavLink>
          </div>
        </div>
      )}
      <main className="page">{children}</main>
    </>
  );
}
