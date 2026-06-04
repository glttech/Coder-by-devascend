'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: { id: string };
}

export default function ImportPRPage({ params }: PageProps) {
  const router = useRouter();
  const [prUrl, setPrUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, prUrl: prUrl.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import failed');
      router.push(`/projects/${params.id}/prs/${body.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Import GitHub PR</h1>
            <p className="page-subtitle">Fetch PR evidence from GitHub and store it for governance review</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="prUrl">
              GitHub PR URL <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="prUrl"
              type="text"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              required
              placeholder="https://github.com/owner/repo/pull/123"
            />
            <div className="form-hint">
              Paste a full PR URL or use shorthand <code>owner/repo#123</code>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <strong>What gets imported:</strong> PR title, description, author, branches, state, merged status, changed file names, CI check summary.<br />
            <strong>Not imported:</strong> Full code diff, secrets, credentials.<br />
            If a <code>GITHUB_TOKEN</code> env var is set server-side, rate limits increase to 5000 req/hr.
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg">
              {loading ? 'Importing…' : 'Import PR'}
            </button>
            <Link href={`/projects/${params.id}`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
