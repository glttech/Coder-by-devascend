"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  taskId: string;
  approvalRequired: boolean;
  approved: boolean | null | undefined;
}

export default function ApprovalPanel({ taskId, approvalRequired, approved }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!approvalRequired) return null;
  const statusLabel = approved === null || approved === undefined ? 'Pending' : approved ? 'Approved' : 'Rejected';
  async function submitApproval(value: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, approved: value }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to update approval');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="approval-panel">
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber-text)', marginBottom: 10 }}>
        Approval Gate
      </div>
      <div className="approval-panel-status">
        Status:{' '}
        <strong style={{ color: approved === true ? 'var(--green-text)' : approved === false ? 'var(--red-text)' : 'var(--amber-text)' }}>
          {statusLabel}
        </strong>
      </div>
      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => submitApproval(true)} disabled={loading || approved === true} className="btn btn-success btn-sm">
          ✓ Approve
        </button>
        <button onClick={() => submitApproval(false)} disabled={loading || approved === false} className="btn btn-danger btn-sm">
          ✕ Reject
        </button>
      </div>
      <p className="approval-panel-note">
        This approval governs actions inside the orchestrator only. External coding agents
        (Claude Code, Codex) are run manually via the Operator Console.
      </p>
    </div>
  );
}