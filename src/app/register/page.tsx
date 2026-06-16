'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          name: form.get('name'),
          orgName: form.get('orgName'),
        }),
      });
      if (res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json() as { error?: string };
      setError(data.error ?? 'Registration failed');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--surface-1)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Create your account</h1>
        <p className="page-subtitle" style={{ marginBottom: 24 }}>Start governing AI work with your team</p>

        {error && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="name">Your name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              disabled={loading}
              placeholder="Jane Smith"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="email">
              Email address <span style={{ color: 'var(--red-text)' }}>*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={loading}
              placeholder="jane@company.com"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="password">
              Password <span style={{ color: 'var(--red-text)' }}>*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={12}
              placeholder="At least 12 characters"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="orgName">Workspace name</label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              autoComplete="organization"
              disabled={loading}
              placeholder="Acme Engineering"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ marginTop: 4 }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--blue)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
