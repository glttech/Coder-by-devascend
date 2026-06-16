'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/',                      label: 'Dashboard',         icon: '⬡' },
  { href: '/projects',              label: 'Projects',          icon: '⬟' },
  { href: '/tasks',                 label: 'Tasks',             icon: '◈' },
  { href: '/instructions/pending',  label: 'Review Queue', icon: '◉' },
  { href: '/audit',                 label: 'Audit Log',         icon: '◎' },
  { href: '/settings/api-keys',     label: 'API Keys',          icon: '⬧' },
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
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        Signed in as <strong style={{ color: 'var(--text-secondary)' }}>{me.username}</strong>
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
      <UserBadge />
    </nav>
  );
}
