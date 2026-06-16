'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const VALID_SCOPES = ['tasks:read', 'tasks:write', 'projects:read', 'projects:write', 'runs:read', 'evidence:read'];

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export default function ApiKeyManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ rawKey: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', scopes: ['tasks:read'] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Failed'); return;
    }
    const { rawKey, apiKey } = await res.json() as { rawKey: string; apiKey: ApiKey };
    setNewKeyData({ rawKey, name: apiKey.name });
    setCreating(false);
    router.refresh();
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    setKeys(k => k.filter(x => x.id !== id));
  }

  function toggleScope(scope: string) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  }

  return (
    <div>
      {/* Show new key once */}
      {newKeyData && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Key created: {newKeyData.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Copy this key now — it will not be shown again:</div>
          <code style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
            {newKeyData.rawKey}
          </code>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(newKeyData.rawKey); }}>Copy</button>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => setNewKeyData(null)}>Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {creating ? (
        <form onSubmit={handleCreate} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Key name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="CI pipeline" required style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Scopes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VALID_SCOPES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.scopes.includes(s)} onChange={() => toggleScope(s)} />
                  <code>{s}</code>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Creating…' : 'Create key'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)} style={{ marginBottom: 16 }}>+ New API key</button>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>No API keys yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td><code style={{ fontFamily: 'monospace', fontSize: 11 }}>{k.prefix}&hellip;</code></td>
                  <td style={{ fontSize: 11 }}>{k.scopes.join(', ')}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => handleRevoke(k.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
