'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddFeatureIdeaForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    const body: Record<string, unknown> = {
      title: data.title,
      relevance: data.relevance,
      riskLevel: data.riskLevel,
      coderHasFeature: data.coderHasFeature === 'on',
    };
    if (data.description) body.description = data.description;
    if (data.problemSolved) body.problemSolved = data.problemSolved;
    if (data.vendor) body.vendor = data.vendor;
    if (data.sourceUrl) body.sourceUrl = data.sourceUrl;
    if (data.coderNotes) body.coderNotes = data.coderNotes;

    try {
      const res = await fetch('/api/feature-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-sm"
        style={{ marginBottom: 16 }}
      >
        + Add Feature Idea
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px',
        marginBottom: 20,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12 }}>
        New Feature Idea
      </div>

      {/* Title */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
          Title *
        </label>
        <input
          name="title"
          required
          placeholder="e.g. Inline diff review in IDE"
          style={{ width: '100%', boxSizing: 'border-box' }}
          className="input"
        />
      </div>

      {/* Vendor + Source URL */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Vendor / Source
          </label>
          <input name="vendor" placeholder="e.g. GitHub Copilot" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Source URL
          </label>
          <input name="sourceUrl" type="url" placeholder="https://..." className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Relevance + Risk */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Relevance
          </label>
          <select name="relevance" defaultValue="medium" className="input" style={{ width: '100%', boxSizing: 'border-box' }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Risk Level
          </label>
          <select name="riskLevel" defaultValue="medium" className="input" style={{ width: '100%', boxSizing: 'border-box' }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
          Description
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="What does this feature do?"
          className="input"
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      {/* Problem Solved */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
          Problem it solves
        </label>
        <input name="problemSolved" placeholder="e.g. Reduces context switching during code review" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
      </div>

      {/* Coder has this + Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
          <input type="checkbox" name="coderHasFeature" />
          Coder already has this feature
        </label>
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Coder notes
          </label>
          <input name="coderNotes" placeholder="How Coder handles this..." className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginBottom: 10 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? 'Saving…' : 'Save idea'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
