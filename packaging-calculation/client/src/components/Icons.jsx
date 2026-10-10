const base = { fill: 'none', stroke: 'currentColor', 'aria-hidden': true };

export const Logo = () => (
  <svg {...base} width="28" height="28" viewBox="0 0 28 28" stroke="#F08A4B" strokeWidth="2">
    <rect x="3" y="15" width="10" height="10" /><rect x="15" y="15" width="10" height="10" /><rect x="9" y="3" width="10" height="10" />
  </svg>
);
export const Plus = () => (<svg {...base} width="16" height="16" viewBox="0 0 16 16" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>);
export const Check = ({ size = 16 }) => (<svg {...base} width={size} height={size} viewBox="0 0 16 16" strokeWidth="2.2"><path d="M3 8.5l3 3 7-7" /></svg>);
export const Star = () => (<svg {...base} width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.8"><path d="M8 1.5l1.6 4.2 4.4.3-3.4 2.8 1.1 4.3L8 10.7l-3.7 2.4 1.1-4.3L2 6l4.4-.3z" /></svg>);
export const Arrow = () => (<svg {...base} width="18" height="18" viewBox="0 0 18 18" strokeWidth="2"><path d="M4 9h10M10 5l4 4-4 4" /></svg>);
export const Back = () => (<svg {...base} width="20" height="20" viewBox="0 0 20 20" strokeWidth="2"><path d="M12.5 4l-6 6 6 6" /></svg>);
export const Phone = () => (<svg {...base} width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.8"><rect x="4" y="1.5" width="8" height="13" rx="1.5" /><path d="M7 12h2" /></svg>);
export const Warn = () => (<svg {...base} width="18" height="18" viewBox="0 0 18 18" stroke="#9A6A00" strokeWidth="1.8" style={{ flex: 'none', marginTop: 2 }}><path d="M9 2l7.5 13h-15z" /><path d="M9 7v4M9 13v.5" /></svg>);

export const ShapeIcon = ({ shape }) => {
  const p = { ...base, width: 40, height: 40, viewBox: '0 0 40 40', strokeWidth: 2 };
  switch (shape) {
    case 'square': return <svg {...p}><rect x="8" y="8" width="24" height="24" /></svg>;
    case 'circle': return <svg {...p}><circle cx="20" cy="20" r="13" /></svg>;
    case 'diamond': return <svg {...p}><path d="M20 5l14 15-14 15L6 20z" /></svg>;
    case 'other': return <svg {...p}><path d="M8 28c0-10 6-18 14-18 6 0 10 4 10 9 0 6-5 7-8 10-3 2-3 5-8 5-5 0-8-2-8-6z" /></svg>;
    default: return <svg {...p}><path d="M6 13l14-7 14 7v15l-14 7-14-7z" /><path d="M6 13l14 7 14-7M20 20v15" /></svg>;
  }
};
