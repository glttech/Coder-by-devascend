'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:            ['pending_approval'],
  pending_approval: ['approved', 'blocked'],
  approved:         ['executing', 'blocked'],
  executing:        ['completed', 'blocked'],
  completed:        [],
  blocked:          [],
};

const LABEL: Record<string, string> = {
  pending_approval: 'Submit for Approval',
  approved:         'Approve',
  executing:        'Mark Executing',
  completed:        'Mark Completed',
  blocked:          'Block',
};

const BUTTON_STYLE: Record<string, React.CSSProperties> = {
  pending_approval: { background: '#d97706', color: '#fff' },
  approved:         { background: '#2563eb', color: '#fff' },
  executing:        { background: '#7c3aed', color: '#fff' },
  completed:        { background: '#16a34a', color: '#fff' },
  blocked:          { background: '#dc2626', color: '#fff' },
};

interface Props {
  instructionId: string;
  currentStatus: string;
}

export default function InstructionActions({ instructionId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [completedNotes, setCompletedNotes] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (allowed.length === 0) return null;

  async function transition(nextStatus: string, extra: Record<string, string> = {}) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructions/${instructionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Transition failed');
      } else {
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleClick(next: string) {
    setError(null);
    if (next === 'blocked') { setShowBlockForm(true); return; }
    if (next === 'approved') { setShowApproveForm(true); return; }
    if (next === 'completed') { setShowCompleteForm(true); return; }
    transition(next);
  }

  const btnBase: React.CSSProperties = {
    padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    border: 'none', cursor: 'pointer', marginRight: 6, opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={{ marginTop: 4 }}>
      {!showBlockForm && !showApproveForm && !showCompleteForm && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {allowed.map((next) => (
            <button
              key={next}
              disabled={loading}
              onClick={() => handleClick(next)}
              style={{ ...btnBase, ...BUTTON_STYLE[next] }}
            >
              {LABEL[next] ?? next}
            </button>
          ))}
        </div>
      )}

      {showApproveForm && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
          <input
            placeholder="Approval note (optional)"
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={loading}
              onClick={() => transition('approved', { approvalNote })}
              style={{ ...btnBase, ...BUTTON_STYLE.approved }}
            >
              Confirm Approve
            </button>
            <button
              disabled={loading}
              onClick={() => setShowApproveForm(false)}
              style={{ ...btnBase, background: '#6b7280', color: '#fff' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCompleteForm && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
          <input
            placeholder="Completion notes (optional)"
            value={completedNotes}
            onChange={(e) => setCompletedNotes(e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={loading}
              onClick={() => transition('completed', { completedNotes })}
              style={{ ...btnBase, ...BUTTON_STYLE.completed }}
            >
              Confirm Complete
            </button>
            <button
              disabled={loading}
              onClick={() => setShowCompleteForm(false)}
              style={{ ...btnBase, background: '#6b7280', color: '#fff' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showBlockForm && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
          <input
            placeholder="Reason for blocking (required)"
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={loading || blockedReason.trim().length === 0}
              onClick={() => transition('blocked', { blockedReason })}
              style={{ ...btnBase, ...BUTTON_STYLE.blocked, opacity: blockedReason.trim().length === 0 || loading ? 0.5 : 1 }}
            >
              Confirm Block
            </button>
            <button
              disabled={loading}
              onClick={() => { setShowBlockForm(false); setBlockedReason(''); }}
              style={{ ...btnBase, background: '#6b7280', color: '#fff' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
