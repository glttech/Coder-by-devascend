'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface PageProps {
  params: { id: string };
}

export default function NewMilestonePage({ params }: PageProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`/api/projects/${params.id}/milestones`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          targetDate: targetDate || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create milestone');
      }

      router.push(`/projects/${params.id}/milestones`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <Link href={`/projects/${params.id}/milestones`} style={{ color: 'var(--blue)' }}>Milestones</Link>
              {' → '}
              <span>New Milestone</span>
            </nav>
            <h1 className="page-title">New Milestone</h1>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="title">
              Title <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint 1 — Auth & onboarding"
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — describe the goals for this milestone"
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="targetDate">Target Date</label>
            <input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="submit" disabled={loading || !csrfToken} className="btn btn-primary">
              {loading ? 'Creating…' : 'Create Milestone'}
            </button>
            <Link href={`/projects/${params.id}/milestones`} className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
