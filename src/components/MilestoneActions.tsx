'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface Props {
  milestoneId: string;
  projectId: string;
  status: string;
}

export default function MilestoneActions({ milestoneId, projectId, status }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = status === 'open';
  const newStatus = isOpen ? 'completed' : 'open';
  const label = isOpen ? 'Mark Complete' : 'Re-open';

  async function handleToggle() {
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update milestone');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={loading || !csrfToken}
        className={`btn btn-sm ${isOpen ? 'btn-primary' : 'btn-ghost'}`}
      >
        {loading ? 'Updating…' : label}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}
