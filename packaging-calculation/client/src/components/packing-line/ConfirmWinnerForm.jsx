import React, { useState } from 'react';
import { Award, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import ErrorNotice from '../ErrorNotice.jsx';
import { num } from '../../format.js';

const ALGO_NAMES = {
  grid: 'Grid packing (box)',
  column: 'Column Stacking',
  pattern: 'Repeating Pattern',
  cluster: 'Cluster Packing',
  nested: 'Nested Clusters'
};

const d3 = (o) => (o ? `${num(o.l)}×${num(o.w)}×${num(o.h)}` : '');

export default function ConfirmWinnerForm({
  run,
  selCartonId,
  onLocked,
  canEdit
}) {
  const r = run.result;
  const currentCarton = r.cartons.find((x) => x.id === selCartonId) || r.cartons[0];
  const bestContainer = currentCarton?.containers?.find((k) => k.recommended) || currentCarton?.containers?.[0];

  const [form, setForm] = useState({
    cartonId: run.lock?.cartonId || r.winner?.cartonId || currentCarton?.id || '',
    containerId: run.lock?.containerId || r.winner?.containerId || bestContainer?.id || '',
    reason: run.lock?.reason || ''
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lockedSuccess, setLockedSuccess] = useState(false);

  const formCarton = r.cartons.find((x) => x.id === form.cartonId) || currentCarton;
  const isLocked = !!run.lock?.at;

  const handleLock = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await onLocked({
        ...form,
        algorithm: formCarton?.method || 'grid'
      });
      setLockedSuccess(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sh-winner-section">
      {/* Decision Summary Card */}
      <div className="sh-decision-card">
        <div className="sh-decision-header">
          <div className="sh-decision-badge">
            <Award size={18} />
            <span>Recommended Decision Winner</span>
          </div>
          {isLocked ? (
            <span className="sh-badge sh-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> Confirmed &amp; Locked
            </span>
          ) : (
            <span className="sh-badge sh-badge-blue">Optimal Quoted Route</span>
          )}
        </div>

        <div className="sh-decision-grid">
          <div className="sh-decision-item">
            <span className="label">Winning Carton</span>
            <b className="val">{formCarton?.name || currentCarton?.name}</b>
            <small className="sub">{d3(formCarton?.outer || currentCarton?.outer)} mm</small>
          </div>

          <div className="sh-decision-item">
            <span className="label">Winning Pallet</span>
            <b className="val">{r.pallet?.name}</b>
            <small className="sub">Deck {num(r.pallet?.deckH)} mm</small>
          </div>

          <div className="sh-decision-item">
            <span className="label">Winning Container</span>
            <b className="val">
              {formCarton?.containers?.find((k) => k.id === form.containerId)?.name || bestContainer?.name}
            </b>
            <small className="sub">{num(bestContainer?.pallets || 0)} pallets per run</small>
          </div>

          <div className="sh-decision-item">
            <span className="label">Packing Algorithm</span>
            <b className="val">{ALGO_NAMES[formCarton?.method] || 'Grid packing (box)'}</b>
            <small className="sub">
              {formCarton?.fill}% volumetric fill
            </small>
          </div>
        </div>
      </div>

      {/* Confirmation Form */}
      <div className={`sh-lock-confirm-box ${isLocked ? 'locked' : ''}`}>
        <h4 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
          {isLocked ? 'Locked Production Plan' : 'Confirm and Lock Winner for ERP Export'}
        </h4>

        {isLocked ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--sh-success)' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Locked by {run.lock.byName} on {new Date(run.lock.at).toLocaleString()}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--sh-ink-2)' }}>
                Carton: {r.cartons.find((x) => x.id === run.lock.cartonId)?.name} · Container:{' '}
                {r.cartons
                  .find((x) => x.id === run.lock.cartonId)
                  ?.containers?.find((k) => k.id === run.lock.containerId)?.name}{' '}
                · Method: {ALGO_NAMES[run.lock.algorithm] || 'Grid'}
                {run.lock.reason && ` · Note: "${run.lock.reason}"`}
              </p>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <div className="grid-fit" style={{ maxWidth: 960 }}>
              <div className="field">
                <label htmlFor="sh-wc" style={{ fontSize: 13, fontWeight: 600 }}>
                  Carton
                </label>
                <select
                  id="sh-wc"
                  className="input"
                  disabled={!canEdit}
                  value={form.cartonId}
                  onChange={(e) => {
                    const x = r.cartons.find((y) => y.id === e.target.value);
                    setForm({
                      ...form,
                      cartonId: e.target.value,
                      containerId: x?.bestContainerId || x?.containers?.[0]?.id || ''
                    });
                  }}
                >
                  {r.cartons.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {d3(x.outer)} mm
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="sh-wp" style={{ fontSize: 13, fontWeight: 600 }}>
                  Pallet
                </label>
                <select id="sh-wp" className="input" disabled>
                  <option>{r.pallet.name}</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="sh-wk" style={{ fontSize: 13, fontWeight: 600 }}>
                  Container
                </label>
                <select
                  id="sh-wk"
                  className="input"
                  disabled={!canEdit}
                  value={form.containerId}
                  onChange={(e) => setForm({ ...form, containerId: e.target.value })}
                >
                  {formCarton?.containers.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} {k.recommended ? '(Recommended)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="sh-wa" style={{ fontSize: 13, fontWeight: 600 }}>
                  Packing Algorithm
                </label>
                <select id="sh-wa" className="input" disabled>
                  <option>{ALGO_NAMES[formCarton?.method] || 'Grid packing (box)'}</option>
                </select>
              </div>
            </div>

            <div className="field" style={{ maxWidth: 960 }}>
              <label htmlFor="sh-wr" style={{ fontSize: 13, fontWeight: 600 }}>
                Audit Reason / Engineering Justification
              </label>
              <textarea
                id="sh-wr"
                className="input"
                rows={3}
                placeholder="e.g. Approved for export order EX-1042 based on maximum container payload efficiency..."
                style={{ padding: 10, fontSize: 13 }}
                disabled={!canEdit}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <ErrorNotice error={error} />

            {canEdit && (
              <div>
                <button
                  type="button"
                  className="sh-lock-btn"
                  disabled={busy || !form.cartonId || !form.containerId}
                  onClick={handleLock}
                >
                  <Lock size={15} />
                  <span>{busy ? 'Locking Result…' : 'Confirm and lock this result'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
