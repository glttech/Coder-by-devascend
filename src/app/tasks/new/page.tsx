"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [agentTool, setAgentTool] = useState('open-swe');
  const [riskLevel, setRiskLevel] = useState('low');
  const [environment, setEnvironment] = useState('local');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instruction, agentTool, riskLevel, environment, approvalRequired }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to create task');
      }
      const task = await res.json();
      router.push(`/tasks/${task.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">New Task</h1>
            <p className="page-subtitle">Define the work unit, agent tool, and risk parameters</p>
          </div>
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
              placeholder="e.g. Refactor auth middleware to use JWT"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="instruction">
              Raw Instruction
              <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              required
              rows={5}
              placeholder="Describe exactly what the agent should do. Be precise about scope, constraints, and expected output."
            />
            <div className="form-hint">This becomes the Objective section of the generated prompt.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="agentTool">Agent / Tool</label>
              <select id="agentTool" value={agentTool} onChange={(e) => setAgentTool(e.target.value)}>
                <option value="open-swe">Open SWE</option>
                <option value="claude-code-manual">Claude Code (manual)</option>
                <option value="codex-manual">Codex (manual)</option>
                <option value="openclaw-manual">OpenClaw (manual)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="riskLevel">Risk Level</label>
              <select id="riskLevel" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
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

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg">
              {loading ? 'Creating…' : 'Create Task'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
