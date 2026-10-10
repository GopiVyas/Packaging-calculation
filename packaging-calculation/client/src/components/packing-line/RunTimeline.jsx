import React from 'react';
import { Lock, Clock, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import Badge from './Badge.jsx';

export const PRESETS = {
  quick: { label: 'Quick (10 s)', short: 'quick 10 s', max: '15 s' },
  standard: { label: 'Standard (60 s)', short: '60 s budget', max: '1.5 min' },
  thorough: { label: 'Thorough (6 min)', short: '6 min budget', max: '9 min' }
};

export default function RunTimeline({ runs = [], selectedId = null, onSelectRun = () => {} }) {
  if (!runs.length) {
    return (
      <div className="run-empty">
        No runs yet. Choose the packaging settings on the right and trigger the first calculation.
      </div>
    );
  }

  return (
    <div className="sh-timeline" role="list" aria-label="Calculation Runs Timeline">
      {runs.map((r, i) => {
        const isSelected = selectedId === r._id;
        const isLocked = !!r.lock?.at;
        const isDone = r.status === 'done';
        const isBusy = r.status === 'queued' || r.status === 'running';

        return (
          <button
            key={r._id}
            type="button"
            className={`sh-timeline-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectRun(r._id)}
            aria-selected={isSelected}
            role="listitem"
          >
            <div className="sh-timeline-header">
              <span className="sh-run-num">{r.number}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {i === 0 && <Badge variant="blue">latest</Badge>}
                {isLocked && (
                  <Badge variant="green" icon={<Lock size={11} />}>
                    Locked
                  </Badge>
                )}
                {r.status && r.status !== 'done' && (
                  <Badge variant={r.status === 'failed' ? 'orange' : 'grey'}>
                    {r.status}
                  </Badge>
                )}
              </div>
            </div>

            <div className="sh-timeline-meta">
              <span>{new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span>·</span>
              <span>{PRESETS[r.preset]?.short || 'instant'}</span>
              <span>·</span>
              <span>
                {r.used?.cartons?.length ?? r.inputs?.cartonIds?.length ?? 1} carton(s)
              </span>
              {isDone && r.durationMs != null && (
                <>
                  <span>·</span>
                  <span style={{ fontFamily: 'var(--sh-mono)' }}>{r.durationMs} ms</span>
                </>
              )}
            </div>

            {isBusy && (
              <div className="progress" style={{ width: '100%', marginTop: 8, height: 6 }}>
                <div
                  style={{
                    width: `${r.progress?.pct || 20}%`,
                    background: 'var(--sh-primary)',
                    borderRadius: 999
                  }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
