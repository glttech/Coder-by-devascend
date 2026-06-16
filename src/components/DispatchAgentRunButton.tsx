'use client';
import { useState } from 'react';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface DispatchAgentRunButtonProps {
  taskId: string;
  taskTitle: string;
  userRole?: string;
}

interface DispatchResult {
  agentRunId: string;
  status: string;
  message: string;
}

export default function DispatchAgentRunButton({
  taskId,
  taskTitle: _taskTitle,
  userRole,
}: DispatchAgentRunButtonProps) {
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !userRole || userRole === 'admin';

  async function handleDispatch() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/agent-runs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data as DispatchResult);
      } else {
        setError((data as { error?: string }).error ?? 'Dispatch failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const statusBadgeStyle = (status: string): React.CSSProperties => {
    const colors: Record<string, { bg: string; color: string }> = {
      queued: { bg: 'rgba(234,179,8,0.12)', color: '#a16207' },
      awaiting_approval: { bg: 'rgba(249,115,22,0.12)', color: '#c2410c' },
      running: { bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
      succeeded: { bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
      failed: { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
    };
    const c = colors[status] ?? { bg: 'rgba(100,116,139,0.12)', color: '#475569' };
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    };
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      {isAdmin ? (
        <button
          className="btn btn-primary btn-sm"
          onClick={handleDispatch}
          disabled={loading}
          title="Dispatch a new automated agent run for this task"
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Dispatching…
            </span>
          ) : (
            'Dispatch Agent Run'
          )}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-sm"
          disabled
          title="Only admins can dispatch agent runs"
          style={{ opacity: 0.5, cursor: 'not-allowed' }}
        >
          Dispatch Agent Run
        </button>
      )}

      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={statusBadgeStyle(result.status)}>
            {result.status === 'awaiting_approval' ? 'Queued (awaiting approval)' : 'Queued'}
          </span>
          <a
            href={`/agent-runs/${result.agentRunId}`}
            style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}
          >
            View run →
          </a>
        </div>
      )}

      {error && (
        <span style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}>{error}</span>
      )}
    </div>
  );
}
