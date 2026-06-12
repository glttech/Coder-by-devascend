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
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess('✓ Response recorded — scroll down to see results');
      setTimeout(() => setSuccess(null), 4000);
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
      <div>
        <button type="submit" disabled={loading} className="btn btn-success">
          {loading ? 'Submitting…' : 'Submit Response'}
        </button>
      </div>
    </form>
  );
}
