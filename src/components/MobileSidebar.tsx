'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '⬡' },
  { href: '/projects', label: 'Projects', icon: '⬟' },
  { href: '/tasks', label: 'Tasks', icon: '◈' },
  { href: '/instructions/pending', label: 'Pending Approvals', icon: '◉' },
  { href: '/audit', label: 'Audit Log', icon: '◎' },
];

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        className="mobile-menu-btn"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(o => !o)}
      >
        ☰
      </button>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
      <nav
        id="mobile-nav"
        role="navigation"
        aria-label="Mobile navigation"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          zIndex: 201, transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease', padding: 24, overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Coder by DevAscend</span>
          <button aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
