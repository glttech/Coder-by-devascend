"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  taskId: string;
  prompt: string;
  defaultTool: string;
}

export default function RunPromptPanel({ taskId, prompt, defaultTool }: Props) {
  const router = useRouter();
  const [selectedTool, setSelectedTool] = useState(defaultTool);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, generatedPrompt: prompt, selectedTool, response }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to submit run');
      }
      router.refresh();
      setResponse('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="selectedTool">Selected Tool</label>
        <select id="selectedTool" value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
          <option value="open-swe">Open SWE</option>
          <option value="claude-code-manual">Claude Code (manual)</option>
          <option value="codex-manual">Codex (manual)</option>
          <option value="openclaw-manual">OpenClaw (manual)</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="response">Paste Agent Response</label>
        <textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={6}
          required
          placeholder="Paste the full agent output here…"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <div className="form-hint">The system will evaluate this and record the run results.</div>
      </div>
      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: 13 }}>
          {error}
        </div>
      )}
      <div>
        <button type="submit" disabled={loading} className="btn btn-success">
          {loading ? 'Submitting…' : 'Submit Response'}
        </button>
      </div>
    </form>
  );
}
