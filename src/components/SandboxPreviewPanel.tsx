'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import type { SandboxPlan } from '@/lib/sandboxPlanner';

interface Props {
  agentRunId: string;
  plan: SandboxPlan;
  sandboxEnabled: boolean;
  userRole: string;
}

export default function SandboxPreviewPanel({ agentRunId, plan, sandboxEnabled, userRole }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  if (!sandboxEnabled) {
    return (
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 13,
          color: '#1d4ed8',
        }}
      >
        Sandbox mode is disabled. Set <code>FEATURE_SANDBOX_MODE=true</code> to enable.
      </div>
    );
  }

  async function handleApprove() {
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/approve-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to approve sandbox run');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!csrfToken) {
      setError('Session error — refresh the page');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/reject-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ reason: 'Rejected via UI' }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to reject sandbox run');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  const riskColor =
    plan.estimatedRisk === 'high'
      ? '#dc2626'
      : plan.estimatedRisk === 'medium'
      ? '#d97706'
      : '#16a34a';

  return (
    <div
      style={{
        border: '2px solid #f59e0b',
        borderRadius: 8,
        padding: 16,
        background: '#fffbeb',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fef3c7',
          borderRadius: 6,
          padding: '8px 12px',
        }}
      >
        <span style={{ fontSize: 16 }}>&#9881;</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#92400e' }}>Sandbox Preview</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            fontWeight: 600,
            color: riskColor,
            background: '#fff',
            border: `1px solid ${riskColor}`,
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          {plan.estimatedRisk.toUpperCase()} RISK
        </span>
      </div>

      {/* Summary */}
      <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>{plan.summary}</p>

      {/* Planned Files */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          PLANNED FILES
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#374151' }}>
          {plan.plannedFiles.map((f, i) => (
            <li key={i} style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Planned Commands */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          PLANNED COMMANDS
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#374151' }}>
          {plan.plannedCommands.map((c, i) => (
            <li key={i} style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 12, color: '#991b1b', marginBottom: 4 }}>
            WARNINGS
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {plan.warnings.map((w, i) => (
              <li key={i} style={{ fontSize: 13, color: '#b91c1c' }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Feature flag note */}
      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        Sandbox mode requires <code>FEATURE_SANDBOX_MODE=true</code>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#dc2626',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? 'Processing…' : '✓ Approve → Queue'}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="btn btn-danger"
          >
            {loading ? 'Processing…' : '✗ Reject'}
          </button>
        </div>
      )}
    </div>
  );
}
