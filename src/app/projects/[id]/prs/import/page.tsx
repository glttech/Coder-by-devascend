'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: { id: string };
}

const ERROR_HINTS: Record<string, string> = {
  AUTH_REQUIRED: 'Ask your admin to set a GITHUB_TOKEN environment variable on the server with "repo" read access.',
  RATE_LIMITED: 'Without a token, GitHub allows ~60 requests/hr. Setting GITHUB_TOKEN server-side raises this to 5,000/hr.',
  NOT_FOUND: 'Double-check the PR URL. Private repos require a GITHUB_TOKEN with repo read access.',
  NETWORK_ERROR: 'The server could not reach api.github.com. Retry in a moment.',
};

export default function ImportPRPage({ params }: PageProps) {
  const router = useRouter();
  const [prUrl, setPrUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/github-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id, prUrl: prUrl.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorCode(body.code ?? null);
        throw new Error(body.error || 'Import failed');
      }
      router.push(`/projects/${params.id}/prs/${body.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  const hint = errorCode ? ERROR_HINTS[errorCode] : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Import GitHub PR</h1>
            <p className="page-subtitle">
              Fetch PR evidence from GitHub and store it for governance review.{' '}
              <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
                ← Back to project
              </Link>
            </p>
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
              style={{ fontFamily: 'monospace' }}
            />
            <div className="form-hint">
              Paste a full GitHub PR URL. The PR must be accessible to the server.
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>What gets imported:</strong> PR title, description,
            author, branches, state, merged status, file names, CI check status.<br />
            <strong style={{ color: 'var(--text-secondary)' }}>Not imported:</strong> Code diff content, credentials, or secrets.<br />
            <strong style={{ color: 'var(--text-secondary)' }}>Private repos:</strong> Require a{' '}
            <code>GITHUB_TOKEN</code> set server-side with <code>repo</code> read access.
            Without a token, GitHub allows ~60 requests/hour.
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: hint ? 4 : 0 }}>{error}</div>
              {hint && (
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{hint}</div>
              )}
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
