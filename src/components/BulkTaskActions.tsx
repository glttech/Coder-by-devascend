'use client';
import { useState } from 'react';

type Task = { id: string; title: string; status: string };

export default function BulkTaskActions({ tasks }: { tasks: Task[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => prev.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)));
  }

  async function applyBulk(action: string, value?: string) {
    if (selected.size === 0) return;
    setLoading(true);
    setMsg('');
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], action, value }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Updated ${data.affected} tasks`);
      setSelected(new Set());
      window.location.reload();
    } else {
      setMsg(data.error ?? 'Bulk action failed');
    }
    setLoading(false);
  }

  const STATUSES = ['pending', 'running', 'completed', 'failed'];
  const PRIORITIES = ['low', 'medium', 'high', 'critical'];

  return (
    <div>
      {selected.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--blue)', color: '#fff', padding: '8px 16px', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: 13 }}>
            <option value="">Set status…</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button disabled={!bulkStatus || loading} onClick={() => applyBulk('status', bulkStatus)} className="btn btn-sm" style={{ background: '#fff', color: 'var(--blue)', border: 'none' }}>
            Apply status
          </button>
          <select value={bulkPriority} onChange={e => setBulkPriority(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: 13 }}>
            <option value="">Set priority…</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button disabled={!bulkPriority || loading} onClick={() => applyBulk('priority', bulkPriority)} className="btn btn-sm" style={{ background: '#fff', color: 'var(--blue)', border: 'none' }}>
            Apply priority
          </button>
          <button disabled={loading} onClick={() => { if (confirm(`Delete ${selected.size} tasks?`)) applyBulk('delete'); }} className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
          {msg && <span style={{ fontSize: 12 }}>{msg}</span>}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}><input type="checkbox" checked={selected.size === tasks.length && tasks.length > 0} onChange={toggleAll} /></th>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} style={{ background: selected.has(task.id) ? 'var(--surface-hover, rgba(59,130,246,0.06))' : undefined }}>
              <td><input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)} /></td>
              <td><a href={`/tasks/${task.id}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>{task.title}</a></td>
              <td><span className={`badge badge-${task.status}`}>{task.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
