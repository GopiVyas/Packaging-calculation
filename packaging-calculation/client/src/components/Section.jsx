// One numbered section card of the part page: header, then 3D on the left and data on the right.
import { useState } from 'react';
import { useI18n } from '../i18n.jsx';

export default function Section({ n, id, help, badge, left, right, children }) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  return (
    <section id={id} className="sec" aria-labelledby={`${id}-h`}>
      <header className="sec-head">
        <span className="sec-no">{n}</span>
        <h2 id={`${id}-h`}>{t(`s${n}`)}</h2>
        {help && (
          <button className="help" aria-expanded={showHelp} aria-label={`About ${t(`s${n}`)}`} onClick={() => setShowHelp(!showHelp)}>?</button>
        )}
        <span className="muted sec-sub">{t(`s${n}d`)}</span>
        {badge && <span className="sec-badge">{badge}</span>}
      </header>
      {showHelp && <p className="sec-help">{help}</p>}
      {children || (
        <div className="sec-body">
          <div className="sec-left">{left}</div>
          <div className="sec-right">{right}</div>
        </div>
      )}
    </section>
  );
}

/** Placeholder shown in a section until its phase is built. */
export function Planned({ phase, items }) {
  const { t } = useI18n();
  return (
    <div className="planned">
      <span className="badge badge-grey">{t('comingIn')} {phase}</span>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

/** Label / value rows used on the right side of every section. */
export function Facts({ rows }) {
  return (
    <dl className="facts">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
