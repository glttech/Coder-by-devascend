'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatrixStatus, STATUS_CONFIG, VALID_STATUSES } from '@/lib/competitiveMatrix';

interface Props {
  competitor: string;
  featureKey: string;
  status: MatrixStatus;
  notes: string | null;
  isAdmin: boolean;
}

export default function MatrixCell({ competitor, featureKey, status, notes, isAdmin }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<MatrixStatus>(status);
  const [localNotes, setLocalNotes] = useState(notes ?? '');

  const cfg = STATUS_CONFIG[localStatus];

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/competitor-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor, featureKey, status: localStatus, notes: localNotes || null }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing && isAdmin) {
    return (
      <td style={{ padding: '6px 8px', verticalAlign: 'top', minWidth: 120 }}>
        <select
          value={localStatus}
          onChange={(e) => setLocalStatus(e.target.value as MatrixStatus)}
          className="input"
          style={{ fontSize: '0.72rem', padding: '2px 4px', marginBottom: 4, width: '100%' }}
        >
          {VALID_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <input
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          placeholder="Notes…"
          className="input"
          style={{ fontSize: '0.68rem', padding: '2px 4px', marginBottom: 4, width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setLocalStatus(status); setLocalNotes(notes ?? ''); }} className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
            ✕
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      onClick={() => isAdmin && setEditing(true)}
      title={notes ?? undefined}
      style={{
        padding: '8px',
        textAlign: 'center',
        cursor: isAdmin ? 'pointer' : 'default',
        verticalAlign: 'middle',
      }}
    >
      <span style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: '0.7rem',
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}`,
        whiteSpace: 'nowrap',
      }}>
        {cfg.label}
      </span>
      {notes && (
        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {notes}
        </div>
      )}
    </td>
  );
}
