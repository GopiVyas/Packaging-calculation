import React from 'react';

/**
 * SpecList: Clean grid/dl key-value rows used across specs and data inspection panels.
 * Accepts rows: Array of [label, value]
 */
export default function SpecList({ rows = [] }) {
  return (
    <dl className="sh-spec-list">
      {rows.filter(Boolean).map(([label, val], idx) => (
        <React.Fragment key={typeof label === 'string' ? label : idx}>
          <dt>{label}</dt>
          <dd>{val}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
