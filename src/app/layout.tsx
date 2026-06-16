import './globals.css';
import type { ReactNode } from 'react';
import SidebarNav from '@/components/SidebarNav';
import SkipToContent from '@/components/SkipToContent';
import MobileSidebar from '@/components/MobileSidebar';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <SkipToContent />
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <MobileSidebar />
              <div className="sidebar-brand-name">AI Dev Orchestrator</div>
              <div className="sidebar-brand-label">Governance Console</div>
            </div>
            <SidebarNav />
            <div className="sidebar-footer">v0.1.0 · Internal</div>
          </aside>
          <div className="main-area">
            <main id="main-content" role="main" className="main-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
