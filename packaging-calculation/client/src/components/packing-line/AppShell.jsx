import React from 'react';
import TopNav from './TopNav.jsx';

export default function AppShell({ children }) {
  return (
    <div className="sh-app-shell">
      <TopNav />
      <main className="page">{children}</main>
    </div>
  );
}
