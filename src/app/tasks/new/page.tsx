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
        body: JSON.stringify({
          title,
          instruction,
          agentTool,
          riskLevel,
          environment,
          approvalRequired,
        }),
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
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">New Task</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="instruction">Raw Instruction</label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            required
            rows={4}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="agentTool">Agent/Tool</label>
            <select
              id="agentTool"
              value={agentTool}
              onChange={(e) => setAgentTool(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="open-swe">Open SWE</option>
              <option value="claude-code-manual">Claude Code (manual)</option>
              <option value="codex-manual">Codex (manual)</option>
              <option value="openclaw-manual">OpenClaw (manual)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="riskLevel">Risk Level</label>
            <select
              id="riskLevel"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="environment">Environment</label>
            <select
              id="environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="local">Local</option>
              <option value="dev">Dev</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            id="approvalRequired"
            type="checkbox"
            checked={approvalRequired}
            onChange={(e) => setApprovalRequired(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="approvalRequired" className="text-sm">Approval required</label>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}