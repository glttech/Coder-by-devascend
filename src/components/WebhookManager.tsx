'use client';
import { useState } from 'react';

const VALID_EVENTS = ['task.created', 'task.status_changed', 'run.completed', 'approval.requested', 'approval.decided'];

interface Webhook { id: string; name: string; url: string; events: string[]; enabled: boolean; lastTriggeredAt: string | null; failureCount: number; }

export default function WebhookManager({ initialWebhooks }: { initialWebhooks: Webhook[] }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function createWebhook() {
    setError(''); setLoading(true);
    const res = await fetch('/api/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url, events: selectedEvents, secret: secret || undefined }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Failed'); return; }
    setWebhooks(prev => [data, ...prev]);
    setName(''); setUrl(''); setSecret(''); setSelectedEvents([]);
  }

  async function toggleWebhook(id: string, enabled: boolean) {
    await fetch(`/api/webhooks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  function toggleEvent(e: string) {
    setSelectedEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Add Webhook</span></div>
        <div className="meta-grid">
          <div className="meta-row"><span className="meta-label">Name</span><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="My Slack webhook" /></div>
          <div className="meta-row"><span className="meta-label">URL (https)</span><input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..." /></div>
          <div className="meta-row"><span className="meta-label">Secret (optional)</span><input className="input" value={secret} onChange={e => setSecret(e.target.value)} placeholder="HMAC signing secret" /></div>
          <div className="meta-row">
            <span className="meta-label">Events</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VALID_EVENTS.map(ev => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} />
                  <span style={{ fontFamily: 'monospace' }}>{ev}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={createWebhook} disabled={loading || !name || !url || selectedEvents.length === 0}>
          {loading ? 'Creating...' : 'Create Webhook'}
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No webhooks configured. Add one above.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Last fired</th><th>Actions</th></tr></thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id}>
                  <td style={{ fontWeight: 500 }}>{wh.name}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{wh.url.slice(0, 50)}{wh.url.length > 50 ? '…' : ''}</span></td>
                  <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{wh.events.map(e => <span key={e} className="badge badge-neutral" style={{ fontSize: 10 }}>{e}</span>)}</div></td>
                  <td>
                    <span className={`badge ${wh.enabled ? 'badge-success' : 'badge-neutral'}`}>{wh.enabled ? 'enabled' : 'disabled'}</span>
                    {wh.failureCount > 0 && <span className="badge badge-sev-high" style={{ marginLeft: 4 }}>{wh.failureCount} failures</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wh.lastTriggeredAt ? new Date(wh.lastTriggeredAt).toLocaleString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleWebhook(wh.id, !wh.enabled)}>{wh.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteWebhook(wh.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
