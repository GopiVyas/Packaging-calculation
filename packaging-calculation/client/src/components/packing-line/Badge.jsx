import React from 'react';

export default function Badge({ children, variant = 'grey', icon = null, title = '' }) {
  const cls = `sh-badge sh-badge-${variant}`;
  return (
    <span className={cls} title={title}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}
