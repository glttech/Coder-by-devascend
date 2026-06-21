'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  repoId: string;
  syncStatus: string;
}

export default function SyncButton({ repoId, syncStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/coder/repositories/${repoId}/sync`, { method: 'POST' });
      const data = await res.json() as { imported?: number; updated?: number; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ imported: data.imported ?? 0, updated: data.updated ?? 0, errors: data.errors ?? [] });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        onClick={handleSync}
        disabled={loading || syncStatus === 'syncing'}
        className="btn btn-ghost btn-sm"
      >
        {loading ? 'Syncing…' : 'Sync PRs'}
      </button>
      {result && (
        <div style={{ fontSize: 11, color: result.errors.length > 0 ? '#dc2626' : '#16a34a' }}>
          {result.errors.length > 0
            ? `${result.errors[0]}`
            : `↑ ${result.imported} imported, ${result.updated} updated`}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#dc2626' }}>{error}</div>}
    </div>
  );
}
