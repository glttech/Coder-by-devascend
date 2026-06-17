'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'approval_needed' | 'run_completed' | 'run_failed' | 'session_revoked' | string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const TYPE_ICONS: Record<string, string> = {
  approval_needed: '⏳',
  run_completed: '✅',
  run_failed: '❌',
  session_revoked: '🔒',
};

function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] ?? '🔔';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const POLL_INTERVAL_MS = 30_000;

interface Props {
  enabled: boolean;
}

export default function NotificationBell({ enabled }: Props) {
  const [data, setData] = useState<NotificationsResponse>({ notifications: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.status === 403) return; // flag off on server side
      if (!res.ok) return;
      const json: NotificationsResponse = await res.json();
      setData(json);
    } catch {
      // network error — silently ignore
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleMarkAllRead() {
    const unreadIds = data.notifications
      .filter((n) => !n.read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarkingRead(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      });
      if (res.ok) {
        setData((prev) => ({
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      }
    } catch {
      // silently ignore
    } finally {
      setMarkingRead(false);
    }
  }

  const displayed = data.notifications.slice(0, 10);
  const hasUnread = data.unreadCount > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={() => enabled && setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: enabled ? 'pointer' : 'default',
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          color: enabled ? 'var(--sidebar-text)' : 'var(--text-muted)',
          opacity: enabled ? 1 : 0.45,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {enabled && hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: 'var(--red)',
              color: '#fff',
              borderRadius: 'var(--radius-pill)',
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && enabled && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-secondary)',
              }}
            >
              Notifications
            </span>
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--brand)',
                  padding: '2px 4px',
                  borderRadius: 'var(--radius-sm)',
                  opacity: markingRead ? 0.6 : 1,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {displayed.length === 0 ? (
              <div
                style={{
                  padding: '24px 14px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                No notifications
              </div>
            ) : (
              displayed.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'var(--brand-light)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {getTypeIcon(n.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.read ? 400 : 600,
                        color: 'var(--text)',
                        marginBottom: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        marginBottom: 4,
                      }}
                    >
                      {n.body}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
