'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const ALL_STATUSES: TaskStatus[] = ['pending', 'running', 'completed', 'failed'];

interface MoveTaskButtonProps {
  taskId: string;
  currentStatus: TaskStatus;
  otherStatuses: TaskStatus[];
}

export default function MoveTaskButton({
  taskId,
  currentStatus,
  otherStatuses,
}: MoveTaskButtonProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function move(newStatus: TaskStatus) {
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        style={{
          fontSize: 11,
          padding: '3px 8px',
          border: '1px solid var(--border)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-secondary)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {loading ? 'Moving…' : 'Move →'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 50,
            minWidth: 140,
            overflow: 'hidden',
          }}
        >
          {otherStatuses.map((s) => (
            <button
              key={s}
              onClick={() => move(s)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 12px',
                fontSize: 12,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover, #f3f4f6)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--red)',
            marginTop: 4,
            maxWidth: 200,
            wordBreak: 'break-word',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export { ALL_STATUSES };
