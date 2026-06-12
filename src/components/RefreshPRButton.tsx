'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RefreshResponse } from '@/app/api/github-prs/[id]/refresh/route';

interface Props {
  prId: string;
}

const TIMEOUT_MS = 15_000;

export default function RefreshPRButton({ prId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`/api/github-prs/${prId}/refresh`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const body: RefreshResponse = await res.json();

      if (!body.ok) {
        setError(body.error);
      } else {
        const stateLabel = body.pr.state;
        const ciLabel = body.pr.ciStatus ? ` · CI: ${body.pr.ciStatus}` : '';
        setSuccessMsg(`✓ Updated — ${stateLabel}${ciLabel}`);
        router.refresh();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('GitHub is slow — try again');
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
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
        {loading ? 'Refreshing…' : 'Refresh from GitHub'}
      </button>
      {successMsg && (
        <span style={{ fontSize: 11, color: 'var(--green)', maxWidth: 280, textAlign: 'right', lineHeight: 1.4 }}>
          {successMsg}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 280, textAlign: 'right', lineHeight: 1.4 }}>
          {error}
        </span>
      )}
    </div>
  );
}
