'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CloneTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClone() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/clone`, { method: 'POST' });
      if (res.ok) {
        const clone = await res.json();
        router.push(`/tasks/${clone.id}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Clone failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleClone}
        disabled={loading}
      >
        {loading ? 'Cloning…' : 'Clone'}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 4 }}>{error}</span>
      )}
    </>
  );
}
