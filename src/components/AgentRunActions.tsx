'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface Props {
  agentRunId: string;
  status: string;
  userRole: string;
}

export default function AgentRunActions({ agentRunId, status, userRole }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  // Nothing to show for non-actionable statuses or non-admins
  if (!isAdmin) return null;
  if (!['awaiting_approval', 'queued', 'running'].includes(status)) return null;

  async function handleApprove() {
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve agent run');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to execute agent run');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {error && (
        <div
          style={{
            background: 'var(--red-bg)',
            color: 'var(--red-text)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {status === 'awaiting_approval' && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="btn btn-success"
        >
          {loading ? 'Approving…' : '✓ Approve → Queue'}
        </button>
      )}

      {status === 'queued' && (
        <button
          onClick={handleExecute}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Starting…' : '▶ Execute Run'}
        </button>
      )}

      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid var(--blue)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Running…
        </div>
      )}
    </div>
  );
}
