'use client';
import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';

const NO_SIDEBAR_PATHS = ['/login'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.includes(pathname);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">AI Dev Orchestrator</div>
          <div className="sidebar-brand-label">Governance Console</div>
        </div>
        <SidebarNav />
        <div className="sidebar-footer">v0.1.0 · Internal</div>
      </aside>
      <div className="main-area">
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
