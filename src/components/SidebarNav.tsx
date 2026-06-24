'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_SECTIONS = [
  {
    title: 'AI Work Control',
    items: [
      { href: '/coder/dashboard',    label: 'Exec Dashboard',    icon: '◈' },
      { href: '/coder/tasks',        label: 'Work Control Room', icon: '◈' },
      { href: '/coder/control-room', label: 'Control Room',      icon: '◎' },
      { href: '/coder/sessions',     label: 'CLI Sessions',       icon: '▶' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { href: '/coder/repositories', label: 'Repositories', icon: '⬟' },
      { href: '/coder/policies',     label: 'Cmd Policies', icon: '◉' },
      { href: '/ci',                 label: 'CI Dashboard', icon: '⬭' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/',                     label: 'Dashboard',    icon: '⬡' },
      { href: '/projects',             label: 'Projects',     icon: '⬟' },
      { href: '/tasks',                label: 'Tasks',        icon: '◈' },
      { href: '/instructions/pending', label: 'Review Queue', icon: '◉' },
      { href: '/audit',                label: 'Audit Log',    icon: '◎' },
      { href: '/diagrams',             label: 'Diagrams',     icon: '◆' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings/billing', label: 'Billing', icon: '◇' },
      { href: '/settings/team',    label: 'Team',    icon: '◈' },
    ],
  },
];

interface MeResponse {
  authenticated: boolean;
  authDisabled?: boolean;
  username?: string | null;
}

function UserBadge() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: MeResponse) => setMe(data))
      .catch(() => {});
  }, []);

  if (!me || !me.authenticated || me.authDisabled) return null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>
        Signed in as <strong style={{ color: 'rgba(148,163,184,0.9)' }}>{me.username}</strong>
      </div>
      <button
        onClick={handleLogout}
        className="btn btn-ghost"
        style={{ width: '100%', fontSize: 12, padding: '4px 8px' }}
      >
        Sign out
      </button>
    </div>
  );
}

export default function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav className="sidebar-nav">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="sidebar-section">
          <div className="sidebar-section-title">{section.title}</div>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
      <UserBadge />
    </nav>
  );
}
