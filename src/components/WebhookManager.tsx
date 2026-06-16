'use client';

import { useState } from 'react';

const WEBHOOK_EVENTS = [
  'task.created',
  'task.status_changed',
  'run.completed',
  'approval.requested',
  'approval.decided',
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
}

interface WebhookManagerProps {
  initialWebhooks: Webhook[];
}

export default function WebhookManager({ initialWebhooks }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>(['task.created']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleEvent = (e: string) => {
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  const createWebhook = async () => {
    if (!url.startsWith('https://')) { setError('URL must start with https://'); return; }
    if (events.length === 0) { setError('Select at least one event'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, secret: secret || undefined, events }),
      });
      const data = await res.json() as { webhook?: Webhook; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to create webhook'); return; }
      if (data.webhook) setWebhooks(prev => [...prev, data.webhook!]);
      setUrl('');
      setSecret('');
      setEvents(['task.created']);
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await fetch(`/api/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled: !enabled } : w));
  };

  const deleteWebhook = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div>
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label>Endpoint URL (https:// required)</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/hook" className="input" />
        <label style={{ marginTop: '0.5rem' }}>Signing Secret (optional)</label>
        <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="leave blank to skip signature" className="input" type="password" />
        <div style={{ marginTop: '0.5rem' }}>
          <label>Events</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
                {ev}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button onClick={createWebhook} disabled={loading} className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
          {loading ? 'Creating…' : 'Add Webhook'}
        </button>
      </div>

      {webhooks.length === 0 ? (
        <p className="text-muted">No webhooks configured.</p>
      ) : (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>URL</th><th>Events</th><th>Status</th><th>Failures</th><th>Last Triggered</th><th></th></tr>
          </thead>
          <tbody>
            {webhooks.map(w => (
              <tr key={w.id}>
                <td style={{ wordBreak: 'break-all', maxWidth: 300 }}>{w.url}</td>
                <td>{w.events.join(', ')}</td>
                <td>
                  <button
                    className={`btn btn-sm ${w.enabled ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => toggleEnabled(w.id, w.enabled)}
                  >
                    {w.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>{w.failureCount}</td>
                <td>{w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : '—'}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteWebhook(w.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
