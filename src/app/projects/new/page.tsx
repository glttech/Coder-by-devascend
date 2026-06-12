'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          repoOwner: repoOwner || undefined,
          repoName: repoName || undefined,
          defaultBranch: defaultBranch || 'main',
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create project');
      }
      const project = await res.json();
      setSuccess('✓ Project created! Loading...');
      await new Promise(r => setTimeout(r, 600));
      router.push(`/projects/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">New Project</h1>
            <p className="page-subtitle">Register a GitHub repository to track tasks and pull requests</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="name">
              Project Name <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Coder by DevAscend"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of what this project does"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
              GitHub Repository
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="repoOwner">Owner / Org</label>
                <input
                  id="repoOwner"
                  type="text"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="e.g. glttech"
                />
                <div className="form-hint">GitHub username or org</div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="repoName">Repository</label>
                <input
                  id="repoName"
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="e.g. Coder-by-devascend"
                />
                <div className="form-hint">Repository name (no URL)</div>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0, marginTop: 12 }}>
              <label className="form-label" htmlFor="defaultBranch">Default Branch</label>
              <input
                id="defaultBranch"
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
              />
            </div>
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
              {loading ? 'Creating…' : 'Create Project'}
            </button>
            <Link href="/projects" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
