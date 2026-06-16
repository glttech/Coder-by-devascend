'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',                      label: 'Dashboard',         icon: '⬡' },
  { href: '/projects',              label: 'Projects',          icon: '⬟' },
  { href: '/tasks',                 label: 'Tasks',             icon: '◈' },
  { href: '/instructions/pending',  label: 'Pending Approvals', icon: '◉' },
  { href: '/audit',                 label: 'Audit Log',         icon: '◎' },
  { href: '/diagrams',             label: 'Diagrams',          icon: '◆' },
  { href: '/settings/billing',      label: 'Billing',           icon: '◇' },
  { href: '/settings/team',         label: 'Team',              icon: '◈' },
  { href: '/ci',                    label: 'CI Dashboard',      icon: '⬭' },
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
    </nav>
  );
}
