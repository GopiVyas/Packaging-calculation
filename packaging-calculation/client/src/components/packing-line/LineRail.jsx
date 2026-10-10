import React from 'react';
import { Check, Settings, Box, Layers, Archive, Package, Container, Award, Download } from 'lucide-react';
import { useI18n } from '../../i18n.jsx';

const STATION_ICONS = {
  1: Settings,
  2: Box,
  3: Layers,
  4: Archive,
  5: Package,
  6: Container,
  7: Award,
  8: Download
};

export default function LineRail({
  activeStation = 1,
  completedStations = [],
  onSelectStation = () => {}
}) {
  const { t } = useI18n();

  const stations = [
    { n: 1, key: 's1', label: 'Settings' },
    { n: 2, key: 's2', label: 'Part' },
    { n: 3, key: 's3', label: 'Cluster' },
    { n: 4, key: 's4', label: 'Carton' },
    { n: 5, key: 's5', label: 'Pallet' },
    { n: 6, key: 's6', label: 'Container' },
    { n: 7, key: 's7', label: 'Result' },
    { n: 8, key: 's8', label: 'Download' }
  ];

  return (
    <aside className="sh-line-rail" aria-label="Packaging Line Rail">
      <div className="sh-rail-header">
        <span className="sh-rail-title">The Packing Line</span>
        <span className="sh-rail-progress">
          {activeStation} / {stations.length}
        </span>
      </div>

      {stations.map(({ n, key, label }) => {
        const isActive = activeStation === n;
        const isCompleted = completedStations.includes(n) && !isActive;
        const IconComponent = STATION_ICONS[n] || Box;

        return (
          <button
            key={n}
            type="button"
            className={`sh-rail-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => onSelectStation(n)}
            title={`Jump to Station ${n}: ${t(key)}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="sh-rail-node">
              {isCompleted ? <Check size={13} strokeWidth={2.5} /> : n}
            </span>
            <span className="sh-rail-label">{t(key) || label}</span>
          </button>
        );
      })}
    </aside>
  );
}
