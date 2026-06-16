'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_ITEMS = [
  { href: '/',                      label: 'Dashboard',         icon: '⬡' },
  { href: '/projects',              label: 'Projects',          icon: '⬟' },
  { href: '/tasks',                 label: 'Tasks',             icon: '◈' },
  { href: '/instructions/pending',  label: 'Pending Approvals', icon: '◉' },
  { href: '/audit',                 label: 'Audit Log',         icon: '◎' },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      <div className="sidebar-section-label">Navigation</div>
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
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
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <ThemeToggle />
      </div>
    </nav>
  );
}
