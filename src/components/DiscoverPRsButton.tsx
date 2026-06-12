'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DiscoverResult {
  imported: number;
  skipped: number;
  prs: { id: string; prNumber: number; title: string }[];
}

interface Props {
  projectId: string;
}

export default function DiscoverPRsButton({ projectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDiscover() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/discover-prs`, { method: 'POST' });
      const body = await res.json() as DiscoverResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Discover failed. Please try again.');
      } else {
        setResult(body);
        router.refresh();
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  let statusMessage: string | null = null;
  if (result !== null) {
    if (result.imported === 0) {
      statusMessage = 'Already up to date';
    } else {
      statusMessage = `Found ${result.imported} new PR${result.imported === 1 ? '' : 's'}`;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleDiscover}
        disabled={loading}
        className="btn btn-ghost btn-sm"
        title="Automatically find and import open GitHub PRs for this project's repository"
      >
        {loading ? 'Discovering…' : '↓ Discover PRs'}
      </button>
      {statusMessage && (
        <span style={{ fontSize: 11, color: result?.imported === 0 ? 'var(--text-muted)' : 'var(--green)', lineHeight: 1.4 }}>
          {statusMessage}
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
