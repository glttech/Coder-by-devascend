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

const BUTTON_CLASS: Record<string, string> = {
  pending_approval: 'action-btn action-btn-pending',
  approved:         'action-btn action-btn-approve',
  executing:        'action-btn action-btn-execute',
  completed:        'action-btn action-btn-complete',
  blocked:          'action-btn action-btn-block',
};

interface Props {
  instructionId: string;
  currentStatus: string;
}

export default function InstructionActions({ instructionId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
        const messages: Record<string, string> = {
          approved:   '✓ Approved — suggestion accepted',
          blocked:    '✓ Blocked — suggestion rejected',
          executing:  '✓ Marked as executing',
          completed:  '✓ Marked as completed',
        };
        setSuccess(messages[nextStatus] ?? '✓ Updated');
        setTimeout(() => setSuccess(null), 3000);
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

  return (
    <div style={{ marginTop: 4 }}>
      {!showBlockForm && !showApproveForm && !showCompleteForm && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {allowed.map((next) => (
            <button
              key={next}
              disabled={loading}
              onClick={() => handleClick(next)}
              className={BUTTON_CLASS[next] ?? 'action-btn action-btn-pending'}
            >
              {LABEL[next] ?? next}
            </button>
          ))}
        </div>
      )}

      {showApproveForm && (
        <div className="inline-form">
          <input
            className="inline-input"
            placeholder="Approval note (optional)"
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
          />
          <div className="inline-actions">
            <button disabled={loading} onClick={() => transition('approved', { approvalNote })} className="action-btn action-btn-approve">
              Confirm Approve
            </button>
            <button disabled={loading} onClick={() => setShowApproveForm(false)} className="action-btn action-btn-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCompleteForm && (
        <div className="inline-form">
          <input
            className="inline-input"
            placeholder="Completion notes (optional)"
            value={completedNotes}
            onChange={(e) => setCompletedNotes(e.target.value)}
          />
          <div className="inline-actions">
            <button disabled={loading} onClick={() => transition('completed', { completedNotes })} className="action-btn action-btn-complete">
              Confirm Complete
            </button>
            <button disabled={loading} onClick={() => setShowCompleteForm(false)} className="action-btn action-btn-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showBlockForm && (
        <div className="inline-form">
          <input
            className="inline-input"
            placeholder="Reason for blocking (required)"
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
          />
          <div className="inline-actions">
            <button
              disabled={loading || blockedReason.trim().length === 0}
              onClick={() => transition('blocked', { blockedReason })}
              className="action-btn action-btn-block"
            >
              Confirm Block
            </button>
            <button disabled={loading} onClick={() => { setShowBlockForm(false); setBlockedReason(''); }} className="action-btn action-btn-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{error}</p>}
      {success && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          color: '#16a34a',
          fontSize: 13,
          fontWeight: 500,
          marginTop: 8,
        }}>
          {success}
        </div>
      )}
    </div>
  );
}
