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
    <div className="border p-4 rounded bg-yellow-50">
      <h3 className="text-sm font-medium mb-2">Approval</h3>
      <p className="text-sm mb-2">Status: <span className="font-semibold">{statusLabel}</span></p>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="flex space-x-2">
        <button
          onClick={() => submitApproval(true)}
          disabled={loading || approved === true}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => submitApproval(false)}
          disabled={loading || approved === false}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {/* Clarify that approvals only govern workflows within this tool. External agents still run manually. */}
      <p className="text-xs text-gray-600 mt-2">
        Note: Approval here only controls actions inside this orchestrator. External coding agents (e.g. Claude
        Code or Codex) are still run manually in Phase 1.
      </p>
    </div>
  );
}