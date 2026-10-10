import React from 'react';

/**
 * DataTable: Modern data table card with sticky headers, zebra-free rows, hover highlights,
 * and left accent bars for winner/recommended rows.
 */
export default function DataTable({
  columns = [],
  data = [],
  activeKey = null,
  rowKey = (r) => r.id || r._id,
  onRowClick = null,
  bestKey = null,
  recommendedKey = null,
  minWidth = 600,
  maxHeight = null,
  children
}) {
  return (
    <div className="sh-table-card">
      <div className="sh-table-wrap" style={maxHeight ? { maxHeight } : undefined}>
        {children ? (
          <table className="sh-data-table" style={{ minWidth }}>
            {children}
          </table>
        ) : (
          <table className="sh-data-table" style={{ minWidth }}>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={c.key || i} className={c.align === 'right' ? 'r' : ''} style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rIdx) => {
                const k = rowKey(row, rIdx);
                const isActive = activeKey != null && k === activeKey;
                const isBest = bestKey != null && k === bestKey;
                const isRecommended = recommendedKey != null && k === recommendedKey;

                let rowClass = '';
                if (onRowClick) rowClass += ' clickable';
                if (isActive) rowClass += ' active';
                if (isBest) rowClass += ' best-row';
                if (isRecommended) rowClass += ' recommended-row';

                return (
                  <tr
                    key={k}
                    className={rowClass.trim()}
                    onClick={onRowClick ? () => onRowClick(row, k) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row, k) : undefined}
                  >
                    {columns.map((col, cIdx) => {
                      const val = col.render ? col.render(row[col.key], row, rIdx) : row[col.key];
                      const tdClass = `${col.align === 'right' ? 'r' : ''} ${col.mono ? 'mono' : ''}`.trim();
                      return (
                        <td key={col.key || cIdx} className={tdClass}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
