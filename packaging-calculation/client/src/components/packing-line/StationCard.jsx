import React, { useState } from 'react';
import { Package, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useI18n } from '../../i18n.jsx';

export default function StationCard({
  n,
  id,
  title,
  subtitle,
  help,
  badge = null,
  actions = null,
  left = null,
  right = null,
  children = null,
  isLast = false
}) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);

  const displayTitle = title || t(`s${n}`);
  const displaySubtitle = subtitle || t(`s${n}d`);

  return (
    <div className="sh-station-wrapper">
      <section id={id} className="sh-station-card" aria-labelledby={`${id}-h`}>
        <header className="sh-station-head">
          <div className="sh-station-left">
            <span className="sh-station-no">{n}</span>
            <div className="sh-station-titles">
              <h2 id={`${id}-h`}>
                {displayTitle}
                {badge && <span style={{ marginLeft: 6 }}>{badge}</span>}
              </h2>
              {displaySubtitle && <p className="sh-station-desc">{displaySubtitle}</p>}
            </div>
          </div>

          <div className="sh-station-actions">
            {actions}
            {help && (
              <button
                className="sh-help-btn"
                aria-expanded={showHelp}
                aria-label={`About ${displayTitle}`}
                title="Toggle Station Guide"
                onClick={() => setShowHelp(!showHelp)}
              >
                ?
              </button>
            )}
          </div>
        </header>

        {showHelp && help && (
          <div className="sh-station-help-drawer" role="region" aria-label="Station guidance">
            <HelpCircle size={16} />
            <div>{help}</div>
          </div>
        )}

        <div className="sh-station-body">
          {children ? (
            <div className="sh-station-col-full">{children}</div>
          ) : (
            <>
              {left && <div className="sh-station-col-left">{left}</div>}
              {right && <div className="sh-station-col-right">{right}</div>}
            </>
          )}
        </div>
      </section>

      {!isLast && (
        <div className="sh-station-connector" aria-hidden="true">
          <div className="sh-connector-line" />
          <div className="sh-connector-icon" title="Production Flow">
            <Package size={11} />
          </div>
        </div>
      )}
    </div>
  );
}
