'use client';
import { useState, useEffect, useCallback } from 'react';

type Comment = { id: string; authorId: string; body: string; createdAt: string };

export default function TaskComments({ taskId, currentUserId }: { taskId: string; currentUserId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    if (res.ok) { const data = await res.json(); setComments(data.comments); }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    if (res.ok) { setDraft(''); load(); }
    else { const d = await res.json(); setError(d.error ?? 'Failed to post'); }
    setSubmitting(false);
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${taskId}/comments/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Comments ({comments.length})
      </div>
      {comments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>No comments yet.</p>}
      {comments.map(c => (
        <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              {c.authorId} · {new Date(c.createdAt).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
          </div>
          {c.authorId === currentUserId && (
            <button onClick={() => remove(c.id)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }} title="Delete comment">✕</button>
          )}
        </div>
      ))}
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !draft.trim()}>
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </div>
  );
}
