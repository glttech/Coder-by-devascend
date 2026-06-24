'use client';
import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';
import NotificationBell from './NotificationBell';

const NO_SIDEBAR_PATHS = ['/login'];

interface AppShellProps {
  children: React.ReactNode;
  notificationsEnabled?: boolean;
}

export default function AppShell({ children, notificationsEnabled = false }: AppShellProps) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.includes(pathname);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="sidebar-brand-name">Coder / by DevAscend</div>
            <div className="sidebar-brand-label">AI Work Control Room</div>
          </div>
          <NotificationBell enabled={notificationsEnabled} />
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
