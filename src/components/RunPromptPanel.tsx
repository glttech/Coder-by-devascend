"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  taskId: string;
  prompt: string;
  defaultTool: string;
}

/**
 * Component allowing the user to run a prompt manually.  The generated prompt
 * is shown above on the Task page; here we provide a textarea for the user to
 * paste the agent response.  On submission the run is recorded via the
 * `/api/runs` endpoint and the page is refreshed to show the new run and
 * evaluation results.
 */
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
        body: JSON.stringify({
          taskId,
          generatedPrompt: prompt,
          selectedTool,
          response,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to submit run');
      }
      // Refresh the page to show the new run
      router.refresh();
      setResponse('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="selectedTool">Selected Tool</label>
        <select
          id="selectedTool"
          value={selectedTool}
          onChange={(e) => setSelectedTool(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="open-swe">Open SWE</option>
          <option value="claude-code-manual">Claude Code (manual)</option>
          <option value="codex-manual">Codex (manual)</option>
          <option value="openclaw-manual">OpenClaw (manual)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="response">Paste Agent Response</label>
        <textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={6}
          required
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Paste the full agent output here.  The system will evaluate it and
          record the results.
        </p>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Response'}
      </button>
    </form>
  );
}