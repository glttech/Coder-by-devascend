'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  prId: string;
}

export default function RefreshPRButton({ prId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/github-prs/${prId}/refresh`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Refresh failed');
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="btn btn-ghost btn-sm"
        title="Re-fetch latest state, CI status, and metadata from GitHub"
      >
        {loading ? 'Refreshing…' : success ? 'Refreshed ✓' : 'Refresh from GitHub'}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 280, textAlign: 'right', lineHeight: 1.4 }}>
          {error}
        </span>
      )}
    </div>
  );
}
