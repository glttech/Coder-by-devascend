'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  projectId: string;
  label?: string;
}

type SyncState = 'idle' | 'running' | 'done' | 'error';

interface SyncStatusPoll {
  syncStatus: string;
  totalSynced: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  updatedAt: string | null;
}

export default function FullSyncButton({ projectId, label = 'Import PR History' }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [result, setResult] = useState<{ imported: number; updated: number; errors: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pollStatus, setPollStatus] = useState<SyncStatusPoll | null>(null);
  const startRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    startRef.current = Date.now();
    setElapsedSec(0);
    pollRef.current = setInterval(async () => {
      setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000));
      try {
        const res = await fetch(`/api/github-prs/sync/status?projectId=${encodeURIComponent(projectId)}`);
        if (res.ok) {
          const data = await res.json() as SyncStatusPoll;
          setPollStatus(data);
        }
      } catch {
        // ignore poll errors — the main POST handles final error state
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPollStatus(null);
    setElapsedSec(0);
  }

  async function handleClick() {
    setState('running');
    setResult(null);
    setErrorMsg(null);
    startPolling();
    try {
      const res = await fetch('/api/github-prs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, fullSync: true }),
      });
      const data = await res.json() as { imported?: number; updated?: number; errors?: number; error?: string };
      stopPolling();
      if (!res.ok) {
        setState('error');
        setErrorMsg(data.error ?? 'Sync failed');
        return;
      }
      setState('done');
      setResult({ imported: data.imported ?? 0, updated: data.updated ?? 0, errors: data.errors ?? 0 });
      router.refresh();
    } catch {
      stopPolling();
      setState('error');
      setErrorMsg('Network error — check your connection and try again');
    }
  }

  const isRunning = state === 'running';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleClick}
        disabled={isRunning}
        title="Fetch all PRs from GitHub and import into this project"
      >
        {isRunning ? '⟳ Syncing…' : label}
      </button>

      {isRunning && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {elapsedSec > 0 ? `${elapsedSec}s elapsed` : 'Starting…'}
          {pollStatus && pollStatus.totalSynced > 0
            ? ` · ${pollStatus.totalSynced} synced so far`
            : ''}
        </span>
      )}

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
