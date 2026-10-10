import React from 'react';
import TopNav from './packing-line/TopNav.jsx';

export default function Layout({ children }) {
  return (
    <div className="sh-app-shell">
      <TopNav />
      <main className="page">{children}</main>
    </div>
  );
}

