'use client';

import { useState } from 'react';

/**
 * DemoResetButton — client component.
 *
 * Shown only in non-production environments. Calls POST /api/demo/reset
 * with a window.confirm guard before executing.
 */
export default function DemoResetButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleReset() {
    const confirmed = window.confirm(
      'This will re-seed the database with demo data, replacing any existing records.\n\nContinue?',
    );
    if (!confirmed) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Reset failed');
      }
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reset failed');
      setStatus('error');
    }
  }

  return (
    <div className="section">
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.02)',
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span>Developer tools:</span>
        <button
          onClick={handleReset}
          className="btn btn-ghost btn-sm"
          disabled={status === 'loading'}
          style={{ fontSize: 12 }}
        >
          {status === 'loading' ? 'Resetting…' : 'Reset Demo Data'}
        </button>
        {status === 'done' && (
          <span style={{ fontSize: 12, color: 'var(--green)' }}>
            Demo data reset successfully.
          </span>
        )}
        {status === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--red)' }}>{errorMsg}</span>
        )}
      </div>
    </div>
  );
}
