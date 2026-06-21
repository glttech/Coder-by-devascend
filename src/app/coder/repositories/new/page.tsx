'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NewRepositoryPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    owner: '',
    repo: '',
    defaultBranch: 'main',
    description: '',
    private: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/coder/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/coder/repositories/${data.id!}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/coder/repositories" style={{ fontSize: 13, color: 'var(--blue)' }}>
          ← Repositories
        </Link>
      </div>

      <PageHeader title="Add Repository" subtitle="Register a GitHub repository for work tracking" />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            GitHub Owner <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. octocat"
            value={form.owner}
            onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            GitHub username or organization name
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Repository Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. my-project"
            value={form.repo}
            onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Default Branch
          </label>
          <input
            type="text"
            value={form.defaultBranch}
            onChange={(e) => setForm((f) => ({ ...f, defaultBranch: e.target.value || 'main' }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Description
          </label>
          <input
            type="text"
            placeholder="Optional short description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="private-cb"
            checked={form.private}
            onChange={(e) => setForm((f) => ({ ...f, private: e.target.checked }))}
          />
          <label htmlFor="private-cb" style={{ fontSize: 13 }}>
            Private repository
          </label>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Registering…' : 'Register Repository'}
          </button>
          <Link href="/coder/repositories" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
