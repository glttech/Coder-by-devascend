"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface Props {
  taskId: string;
  approvalRequired: boolean;
  approved: boolean | null | undefined;
  approverName?: string;
}

export default function ApprovalPanel({ taskId, approvalRequired, approved, approverName }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  if (!approvalRequired) return null;
  const statusLabel = approved === null || approved === undefined ? 'Pending' : approved ? 'Approved' : 'Rejected';
  async function submitApproval(value: boolean) {
    if (!csrfToken) { setError('Session error — refresh the page'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ taskId, approved: value }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to update approval');
      }
      setSuccess(value ? '✓ Task approved' : '✓ Task rejected');
      setTimeout(() => setSuccess(null), 3000);
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
      {approverName && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Reviewed by {approverName}
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div className="approval-panel-actions">
        <button onClick={() => submitApproval(true)} disabled={loading || approved === true} className="btn btn-success approval-panel-btn">
          ✓ Approve
        </button>
        <button onClick={() => submitApproval(false)} disabled={loading || approved === false} className="btn btn-danger approval-panel-btn">
          ✕ Reject
        </button>
      </div>
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
      <p className="approval-panel-note">
        This approval governs actions inside the orchestrator only. External coding agents
        (Claude Code, Codex) are run manually via the Operator Console.
      </p>
    </div>
  );
}