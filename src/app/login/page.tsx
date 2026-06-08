'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function isSafeNext(next: string | null): boolean {
  if (!next) return false;
  return next.startsWith('/') && !next.startsWith('//') && !next.includes('://');
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const next = params?.get('next') ?? null;
  const redirectTo = isSafeNext(next) ? next! : '/';

  // Redirect already-authenticated users away from the login page.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: { authenticated?: boolean }) => {
        if (data.authenticated) {
          router.replace(redirectTo);
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Login failed');
        return;
      }
      router.push(redirectTo);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--surface-1)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--surface-1)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Sign in</h1>
        <p className="page-subtitle" style={{ marginBottom: 24 }}>Coder by DevAscend — Internal Tool</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
