import React from 'react';
import { Package, Award, ArrowUpRight } from 'lucide-react';
import { money, num } from '../../format.js';

export default function KpiRibbon({
  partName = '',
  run = null,
  selCartonId = null
}) {
  if (!run || run.status !== 'done' || !run.result) {
    return null;
  }

  const r = run.result;
  const currentCarton = r.cartons.find((x) => x.id === selCartonId) || r.cartons[0];
  if (!currentCarton) return null;

  const bestContainer =
    currentCarton.containers.find((k) => k.recommended) || currentCarton.containers[0];

  const piecesPerCarton = currentCarton.perCarton;
  const piecesPerPallet = currentCarton.piecesPerPallet;
  const palletsPerContainer = bestContainer?.pallets ?? '—';
  const costPerPiece = bestContainer
    ? money(bestContainer.costPerPiece, run.currency)
    : money(currentCarton.costPerPiece, run.currency);

  return (
    <div className="sh-kpi-ribbon" role="region" aria-label="Key Performance Indicators">
      <div className="sh-kpi-container">
        <div className="sh-kpi-part-info">
          <span className="sh-kpi-badge">
            <Package size={13} />
            <span>{partName}</span>
          </span>
          <span className="sh-kpi-run-label">
            Run {run.number} · {currentCarton.name}
          </span>
        </div>

        <div className="sh-kpi-cards">
          <div className="sh-kpi-card">
            <span className="sh-kpi-label">Pcs / Carton</span>
            <span className="sh-kpi-value">
              {num(piecesPerCarton)}
              <small>pcs</small>
            </span>
          </div>

          <div className="sh-kpi-card">
            <span className="sh-kpi-label">Pcs / Pallet</span>
            <span className="sh-kpi-value">
              {num(piecesPerPallet)}
              <small>pcs</small>
            </span>
          </div>

          <div className="sh-kpi-card">
            <span className="sh-kpi-label">Pallets / Cont.</span>
            <span className="sh-kpi-value">
              {palletsPerContainer}
              <small>{bestContainer?.name ? `(${bestContainer.name})` : ''}</small>
            </span>
          </div>

          <div className="sh-kpi-card highlight">
            <span className="sh-kpi-label">Cost / Piece</span>
            <span className="sh-kpi-value" style={{ color: 'var(--sh-primary)' }}>
              {costPerPiece}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
