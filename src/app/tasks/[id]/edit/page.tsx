"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EditTaskPageProps {
  params: { id: string };
}

export default function EditTaskPage({ params }: EditTaskPageProps) {
  const router = useRouter();
  const { id } = params;

  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [riskLevel, setRiskLevel] = useState('low');
  const [environment, setEnvironment] = useState('dev');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((task) => {
        if (task.error) { setLoadError(task.error); return; }
        setTitle(task.title ?? '');
        setInstruction(task.instruction ?? '');
        setRiskLevel(task.riskLevel ?? 'low');
        setEnvironment(task.environment ?? 'dev');
        setApprovalRequired(task.approvalRequired ?? false);
      })
      .catch(() => setLoadError('Failed to load task'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instruction, riskLevel, environment, approvalRequired }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to save');
      }
      router.push(`/tasks/${id}`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (loadError) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: 'var(--red-text)', marginBottom: 16 }}>{loadError}</div>
        <Link href="/tasks" className="btn btn-ghost btn-sm">Back to tasks</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Edit Task</h1>
            <p className="page-subtitle" style={{ fontFamily: 'monospace', fontSize: 11 }}>{id}</p>
          </div>
          <Link href={`/tasks/${id}`} className="btn btn-ghost btn-sm">Cancel</Link>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="title">Task Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={500}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="instruction">Raw Instruction</label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              required
              rows={8}
            />
            <div className="form-hint">This becomes the Objective section of the generated prompt.</div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
              <label className="form-label" htmlFor="riskLevel">Risk Level</label>
              <select id="riskLevel" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
              <label className="form-label" htmlFor="environment">Environment</label>
              <select id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="local">Local</option>
                <option value="dev">Dev</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="approvalRequired"
              type="checkbox"
              checked={approvalRequired}
              onChange={(e) => setApprovalRequired(e.target.checked)}
              style={{ width: 16, height: 16, display: 'inline', cursor: 'pointer' }}
            />
            <label htmlFor="approvalRequired" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
              Approval required before execution
            </label>
          </div>

          {saveError && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href={`/tasks/${id}`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
