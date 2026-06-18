'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface Props {
  incidentId: string;
  currentStatus: string;
  currentFollowUpAction?: string | null;
}

const STATUSES = ['open', 'investigating', 'resolved', 'closed'];

export default function IncidentStatusToggle({ incidentId, currentStatus, currentFollowUpAction }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);
  const [followUpAction, setFollowUpAction] = useState(currentFollowUpAction ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ status, followUpAction: followUpAction || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update incident');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update incident');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Status:
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={loading}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Follow-up action note:
        </label>
        <textarea
          value={followUpAction}
          onChange={(e) => setFollowUpAction(e.target.value)}
          disabled={loading}
          rows={3}
          placeholder="Describe the follow-up action or resolution steps..."
          style={{
            padding: '8px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={loading || !csrfToken}
          className="btn btn-primary btn-sm"
        >
          {loading ? 'Updating…' : 'Update Incident'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{error}</div>
      )}
    </form>
  );
}
