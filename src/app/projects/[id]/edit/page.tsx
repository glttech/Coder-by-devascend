'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: { id: string };
}

export default function EditProjectPage({ params }: PageProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then((p) => {
        setName(p.name ?? '');
        setDescription(p.description ?? '');
        setRepoOwner(p.repoOwner ?? '');
        setRepoName(p.repoName ?? '');
        setDefaultBranch(p.defaultBranch ?? 'main');
      })
      .catch(() => setError('Failed to load project'))
      .finally(() => setFetching(false));
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          repoOwner: repoOwner || null,
          repoName: repoName || null,
          defaultBranch: defaultBranch || 'main',
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update project');
      }
      router.push(`/projects/${params.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Edit Project</h1>
            <p className="page-subtitle">Update project details and GitHub repository settings</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="name">
              Project Name <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="description">Description</label>
            <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
              GitHub Repository
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="repoOwner">Owner / Org</label>
                <input id="repoOwner" type="text" value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="e.g. glttech" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="repoName">Repository</label>
                <input id="repoName" type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="e.g. Coder-by-devascend" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0, marginTop: 12 }}>
              <label className="form-label" htmlFor="defaultBranch">Default Branch</label>
              <input id="defaultBranch" type="text" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href={`/projects/${params.id}`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
