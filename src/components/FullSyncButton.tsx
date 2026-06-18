'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  projectId: string;
  label?: string;
}

type SyncState = 'idle' | 'running' | 'done' | 'error';

export default function FullSyncButton({ projectId, label = 'Import PR History' }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [result, setResult] = useState<{ imported: number; updated: number; errors: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    setState('running');
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/github-prs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, fullSync: true }),
      });
      const data = await res.json() as { imported?: number; updated?: number; errors?: number; error?: string };
      if (!res.ok) {
        setState('error');
        setErrorMsg((data as { error?: string }).error ?? 'Sync failed');
        return;
      }
      setState('done');
      setResult({ imported: data.imported ?? 0, updated: data.updated ?? 0, errors: data.errors ?? 0 });
      router.refresh();
    } catch {
      setState('error');
      setErrorMsg('Network error — check your connection and try again');
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleClick}
        disabled={state === 'running'}
        title="Fetch all PRs from GitHub and import into this project"
      >
        {state === 'running' ? '⟳ Syncing…' : label}
      </button>

      {state === 'done' && result && (
        <span style={{ fontSize: 11, color: 'var(--green)', whiteSpace: 'nowrap' }}>
          ✓ {result.imported} new, {result.updated} updated
          {result.errors > 0 && <span style={{ color: 'var(--amber)' }}>, {result.errors} errors</span>}
        </span>
      )}

      {state === 'error' && errorMsg && (
        <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 280 }}>
          ✕ {errorMsg}
        </span>
      )}
    </div>
  );
}
