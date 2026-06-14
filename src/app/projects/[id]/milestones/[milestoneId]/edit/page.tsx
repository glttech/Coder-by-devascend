'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface PageProps {
  params: { id: string; milestoneId: string };
}

export default function EditMilestonePage({ params }: PageProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${params.id}/milestones/${params.milestoneId}`)
      .then((r) => r.json())
      .then((m) => {
        setTitle(m.title ?? '');
        setDescription(m.description ?? '');
        if (m.targetDate) {
          // Format to YYYY-MM-DD for date input
          setTargetDate(new Date(m.targetDate).toISOString().slice(0, 10));
        } else {
          setTargetDate('');
        }
      })
      .catch(() => setError('Failed to load milestone'))
      .finally(() => setFetching(false));
  }, [params.id, params.milestoneId]);

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

      const res = await fetch(`/api/projects/${params.id}/milestones/${params.milestoneId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          targetDate: targetDate || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update milestone');
      }

      router.push(`/projects/${params.id}/milestones/${params.milestoneId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this milestone? Tasks will be unlinked.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`/api/projects/${params.id}/milestones/${params.milestoneId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete milestone');
      }

      router.push(`/projects/${params.id}/milestones`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete milestone');
    } finally {
      setDeleting(false);
    }
  }

  if (fetching) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <Link href={`/projects/${params.id}/milestones`} style={{ color: 'var(--blue)' }}>Milestones</Link>
              {' → '}
              <Link href={`/projects/${params.id}/milestones/${params.milestoneId}`} style={{ color: 'var(--blue)' }}>
                Milestone
              </Link>
              {' → '}
              <span>Edit</span>
            </nav>
            <h1 className="page-title">Edit Milestone</h1>
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
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href={`/projects/${params.id}/milestones/${params.milestoneId}`} className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Delete section */}
      <div className="card" style={{ maxWidth: 560, marginTop: 24, borderColor: 'var(--red)', borderWidth: 1, borderStyle: 'solid' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>Danger Zone</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Deleting this milestone will unlink all associated tasks. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || !csrfToken}
          className="btn btn-sm"
          style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
        >
          {deleting ? 'Deleting…' : 'Delete Milestone'}
        </button>
      </div>
    </div>
  );
}
