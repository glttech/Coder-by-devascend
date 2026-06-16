'use client';
import { useEffect, useState } from 'react';

interface Prefs {
  emailInvite: boolean;
  emailApproval: boolean;
  emailRunDone: boolean;
}

export default function NotificationPrefsForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then((r) => r.json())
      .then((data) => setPrefs(data.prefs));
  }, []);

  async function handleToggle(key: keyof Prefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (res.ok) {
        setMessage('Saved');
      } else {
        setMessage('Error saving');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return <p>Loading...</p>;

  return (
    <div>
      {(['emailInvite', 'emailApproval', 'emailRunDone'] as const).map((key) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs[key]}
            onChange={() => handleToggle(key)}
            disabled={saving}
            style={{ width: 18, height: 18 }}
          />
          <span>
            {key === 'emailInvite' && 'Email me when I receive an invitation'}
            {key === 'emailApproval' && 'Email me when a task needs my approval'}
            {key === 'emailRunDone' && 'Email me when an agent run completes'}
          </span>
        </label>
      ))}
      {message && <p style={{ color: message === 'Saved' ? 'green' : 'red', fontSize: 14 }}>{message}</p>}
    </div>
  );
}
