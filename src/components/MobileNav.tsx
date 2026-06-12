'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/tasks',                label: 'Tasks',   icon: '◈' },
  { href: '/projects',             label: 'Projects', icon: '⬟' },
  { href: '/instructions/pending', label: 'Audit',   icon: '◉' },
];

export default function MobileNav() {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === '/login') return null;

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
