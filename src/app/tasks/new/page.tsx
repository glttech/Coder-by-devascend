"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Preset {
  id: string;
  label: string;
  description: string;
  agentTool: string;
  riskLevel: string;
  environment: string;
  approvalRequired: boolean;
  titleTemplate: string;
  instructionTemplate: string;
}

const PRESETS: Preset[] = [
  {
    id: 'claude-code-pr',
    label: 'Claude Code — PR',
    description: 'Open a PR for a scoped code change via Claude Code CLI',
    agentTool: 'claude-code-manual',
    riskLevel: 'low',
    environment: 'dev',
    approvalRequired: false,
    titleTemplate: 'Claude Code: ',
    instructionTemplate:
      'Make the following change using Claude Code CLI:\n\n' +
      '<describe the change here>\n\n' +
      'Constraints:\n' +
      '- Touch only the files required for this change.\n' +
      '- Do not refactor unrelated code.\n' +
      '- Do not install new dependencies without approval.\n' +
      '- Run npm run build and npm test before reporting back.\n\n' +
      'Report: files changed, commands run, build/test output, commit hash.',
  },
  {
    id: 'openclaw-dev-deploy',
    label: 'OpenClaw — DEV Deploy',
    description: 'Deploy a named service to the DEV environment via OpenClaw',
    agentTool: 'openclaw-manual',
    riskLevel: 'medium',
    environment: 'dev',
    approvalRequired: true,
    titleTemplate: 'Deploy to DEV: ',
    instructionTemplate:
      'Deploy the following service to the DEV environment using OpenClaw:\n\n' +
      'Service: <service-name>\n' +
      'Branch / tag: <branch-or-tag>\n\n' +
      'Pre-deploy checklist:\n' +
      '1. Confirm the branch is up to date with main.\n' +
      '2. Confirm no pending migrations.\n' +
      '3. Confirm all tests pass on CI.\n\n' +
      'After deploy:\n' +
      '- Run the smoke test suite and report results.\n' +
      '- Check container health (no restarts, all healthy).\n' +
      '- Do not touch production. Do not touch .env files.\n\n' +
      'Report: deploy command run, container status, smoke test output, any warnings.',
  },
  {
    id: 'openclaw-readonly',
    label: 'OpenClaw — Read-only Validation',
    description: 'Inspect DEV environment state without making changes',
    agentTool: 'openclaw-manual',
    riskLevel: 'low',
    environment: 'dev',
    approvalRequired: false,
    titleTemplate: 'DEV Validation: ',
    instructionTemplate:
      'Perform a read-only inspection of the DEV environment. Do not make any changes.\n\n' +
      'Check:\n' +
      '1. All expected containers are running and healthy.\n' +
      '2. No containers are restarting unexpectedly.\n' +
      '3. No duplicate or stale containers.\n' +
      '4. Recent logs show no critical errors.\n\n' +
      'Constraints:\n' +
      '- Read-only. No restarts, no file changes, no config updates.\n' +
      '- Do not touch production. Do not expose secrets in output.\n\n' +
      'Report: container list, health status, any warnings or anomalies found.',
  },
  {
    id: 'codex-review',
    label: 'Codex — Code Review',
    description: 'Ask Codex to review a diff or file for issues',
    agentTool: 'codex-manual',
    riskLevel: 'low',
    environment: 'local',
    approvalRequired: false,
    titleTemplate: 'Codex Review: ',
    instructionTemplate:
      'Review the following code for correctness, security, and maintainability:\n\n' +
      '<paste diff or file path here>\n\n' +
      'Focus on:\n' +
      '1. Logic errors or edge cases.\n' +
      '2. Security issues (injection, auth bypass, secret exposure).\n' +
      '3. Performance problems.\n' +
      '4. Missing error handling.\n\n' +
      'Format your response as:\n' +
      '- Summary (1-3 sentences)\n' +
      '- Issues found (severity: critical/high/medium/low, description, suggested fix)\n' +
      '- Files reviewed\n' +
      '- Overall recommendation: approve / request changes',
  },
  {
    id: 'security-change',
    label: 'Security-Sensitive Change',
    description: 'Auth, permissions, secrets, or infra — requires senior approval',
    agentTool: 'claude-code-manual',
    riskLevel: 'high',
    environment: 'local',
    approvalRequired: true,
    titleTemplate: 'Security: ',
    instructionTemplate:
      'Make the following security-sensitive change:\n\n' +
      '<describe the change here>\n\n' +
      'Hard constraints:\n' +
      '- Do not weaken any existing authentication or authorization check.\n' +
      '- Do not log, print, or expose any secrets, tokens, or credentials.\n' +
      '- Do not modify .env files.\n' +
      '- Do not touch production.\n' +
      '- Run npm run build and npm test before reporting.\n\n' +
      'After making the change:\n' +
      '1. List every file modified.\n' +
      '2. Describe exactly what security behavior changed and why it is safe.\n' +
      '3. Identify any residual risks.\n\n' +
      'A senior engineer will review before this task is approved.',
  },
];

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [agentTool, setAgentTool] = useState('claude-code-manual');
  const [riskLevel, setRiskLevel] = useState('low');
  const [environment, setEnvironment] = useState('dev');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setAgentTool(preset.agentTool);
    setRiskLevel(preset.riskLevel);
    setEnvironment(preset.environment);
    setApprovalRequired(preset.approvalRequired);
    if (!title || title === PRESETS.find((p) => p.id !== preset.id && title === p.titleTemplate)?.titleTemplate) {
      setTitle(preset.titleTemplate);
    }
    setInstruction(preset.instructionTemplate);
  }

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
      setSuccess('✓ Task created! Loading...');
      await new Promise(r => setTimeout(r, 600));
      router.push(`/tasks/${task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
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
            <p className="page-subtitle">Describe what you want the AI to work on</p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Start from a preset
        </div>
        <div className="preset-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card${activePreset === preset.id ? ' active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              <div className="preset-card-label">{preset.label}</div>
              <div className="preset-card-desc">{preset.description}</div>
              <div className="preset-card-meta">
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{preset.agentTool}</span>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{preset.environment}</span>
                {preset.approvalRequired && (
                  <span className="badge badge-sev-high" style={{ fontSize: 10 }}>approval</span>
                )}
              </div>
            </button>
          ))}
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
              Task Description
              <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              required
              rows={8}
              placeholder="Describe exactly what the agent should do. Be precise about scope, constraints, and expected output."
            />
            <div className="form-hint">Describe exactly what you want the AI to do — what to change, create, or fix.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="agentTool">AI Tool</label>
              <select id="agentTool" value={agentTool} onChange={(e) => setAgentTool(e.target.value)}>
                <option value="claude-code-manual">Claude Code</option>
                <option value="codex-manual">Codex</option>
                <option value="openclaw-manual">OpenClaw</option>
                <option value="open-swe">Open SWE</option>
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

          {success && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#16a34a',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {success}
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
