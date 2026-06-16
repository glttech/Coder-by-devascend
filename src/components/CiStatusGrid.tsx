'use client';
import { useState, useEffect } from 'react';

type ProjectHealth = {
  projectId: string;
  projectName: string;
  total: number;
  success: number;
  failure: number;
  pending: number;
  signal: 'green' | 'yellow' | 'red' | 'none';
};

const SIGNAL_COLORS = { green: '#16a34a', yellow: '#ca8a04', red: '#dc2626', none: '#9ca3af' };
const SIGNAL_ICONS = { green: '✅', yellow: '⏳', red: '❌', none: '○' };
const SIGNAL_LABELS = { green: 'All passing', yellow: 'Pending CI', red: 'Failures', none: 'No data' };

export default function CiStatusGrid() {
  const [data, setData] = useState<{ projects: ProjectHealth[]; overall: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/ci/status');
      if (!res.ok) throw new Error('Failed to load CI status');
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 24 }}>Loading CI status…</div>;
  if (error) return <div style={{ color: 'var(--red)', padding: 24 }}>{error}</div>;
  if (!data) return null;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(data.overall).map(([signal, count]) => (
          <div key={signal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span>{SIGNAL_ICONS[signal as keyof typeof SIGNAL_ICONS]}</span>
            <span style={{ fontWeight: 600, color: SIGNAL_COLORS[signal as keyof typeof SIGNAL_COLORS] }}>{count}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{SIGNAL_LABELS[signal as keyof typeof SIGNAL_LABELS]}</span>
          </div>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Project grid */}
      {data.projects.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>No projects with tracked PRs yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {data.projects.map(p => (
            <a key={p.projectId} href={`/projects/${p.projectId}`} style={{ textDecoration: 'none' }}>
              <div style={{ padding: 16, borderRadius: 8, border: `2px solid ${SIGNAL_COLORS[p.signal]}`, background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{SIGNAL_ICONS[p.signal]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{p.projectName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.total} open PRs · ✅ {p.success} / ❌ {p.failure} / ⏳ {p.pending}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
