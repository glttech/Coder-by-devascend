'use client';
import { useState } from 'react';

export default function CreateShareLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch('/api/share-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, ttlDays: 30 }),
    });
    const data = await res.json();
    setUrl(data.shareUrl ?? '');
    setLoading(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {!url ? (
        <button onClick={create} disabled={loading} className="btn btn-ghost btn-sm">
          {loading ? 'Creating…' : '🔗 Share report'}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={url} readOnly style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text-primary)' }} />
          <button onClick={copy} className="btn btn-ghost btn-sm">{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  );
}
