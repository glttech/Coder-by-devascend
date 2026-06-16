'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InvitePage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function accept() {
    setStatus('loading');
    const res = await fetch(`/api/invite/${params.token}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setStatus('done');
      setTimeout(() => router.push('/'), 1500);
    } else {
      setStatus('error');
      setMsg(data.error ?? 'Failed to accept invite');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You have been invited</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
          Accept this invitation to join the team. If you don&apos;t have an account yet, you&apos;ll be prompted to create one after accepting.
        </p>
        {status === 'done' && <p style={{ color: 'var(--green)' }}>Invite accepted! Redirecting&hellip;</p>}
        {status === 'error' && <p style={{ color: 'var(--red)' }}>{msg}</p>}
        {status !== 'done' && (
          <button className="btn btn-primary" onClick={accept} disabled={status === 'loading'} style={{ width: '100%' }}>
            {status === 'loading' ? 'Accepting…' : 'Accept Invitation'}
          </button>
        )}
      </div>
    </div>
  );
}
