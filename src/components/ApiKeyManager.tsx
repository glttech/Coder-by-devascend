'use client';

import { useState } from 'react';
import { VALID_SCOPES } from '@/lib/apiKeys';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface ApiKeyManagerProps {
  initialKeys: ApiKey[];
}

export default function ApiKeyManager({ initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['tasks:read']);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleScope = (s: string) => {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const createKey = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (scopes.length === 0) { setError('Select at least one scope'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes }),
      });
      const data = await res.json() as { rawKey?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to create key'); return; }
      setRawKey(data.rawKey ?? null);
      setName('');
      setScopes(['tasks:read']);
      const listRes = await fetch('/api/keys');
      const listData = await listRes.json() as { keys: ApiKey[] };
      setKeys(listData.keys ?? []);
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  return (
    <div>
      {rawKey && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          <strong>Copy this key — it will not be shown again:</strong><br />
          {rawKey}
          <button style={{ marginLeft: '1rem' }} onClick={() => setRawKey(null)}>Dismiss</button>
        </div>
      )}

      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CI pipeline" className="input" />
        <div style={{ marginTop: '0.5rem' }}>
          <label>Scopes</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            {VALID_SCOPES.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button onClick={createKey} disabled={loading} className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
          {loading ? 'Creating…' : 'Create API Key'}
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-muted">No API keys yet.</p>
      ) : (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last Used</th><th>Expires</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.prefix}…</code></td>
                <td>{k.scopes.join(', ')}</td>
                <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : '—'}</td>
                <td>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => revokeKey(k.id)}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
