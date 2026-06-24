'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PolicyData {
  id: string;
  name: string;
  description: string | null;
  commandPrefixes: string[];
  allowedWorkdirs: string[];
  scrubLogs: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)' }}
        />
        <button type="button" onClick={add} className="btn btn-ghost btn-sm">Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {values.map((v, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '3px 10px', fontSize: 12 }}>
              <code style={{ fontSize: 11 }}>{v}</code>
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PolicyEditor({ initial }: { initial: PolicyData }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [prefixes, setPrefixes] = useState(initial.commandPrefixes);
  const [workdirs, setWorkdirs] = useState(initial.allowedWorkdirs);
  const [scrubLogs, setScrubLogs] = useState(initial.scrubLogs);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/coder/policies/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, commandPrefixes: prefixes, allowedWorkdirs: workdirs, scrubLogs, enabled }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete policy "${initial.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coder/policies/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Delete failed'); return; }
      router.push('/coder/policies');
    } catch {
      setError('Network error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Policy name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', boxSizing: 'border-box' }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <TagInput label="Allowed command prefixes" placeholder="claude --print" values={prefixes} onChange={setPrefixes} />
      <TagInput label="Allowed working directories (absolute paths)" placeholder="/home/user/repos" values={workdirs} onChange={setWorkdirs} />

      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={scrubLogs} onChange={(e) => setScrubLogs(e.target.checked)} />
          Scrub secrets from logs
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      {error && <div style={{ marginBottom: 12, color: '#dc2626', fontSize: 13 }}>{error}</div>}
      {saved && <div style={{ marginBottom: 12, color: '#16a34a', fontSize: 13 }}>Saved.</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="btn btn-ghost" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={handleDelete} disabled={deleting} style={{ marginLeft: 'auto', color: '#dc2626', background: 'none', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
          {deleting ? 'Deleting…' : 'Delete policy'}
        </button>
      </div>
    </form>
  );
}
