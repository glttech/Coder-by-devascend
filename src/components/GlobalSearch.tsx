'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

type Result = { id: string; type: string; title: string; subtitle?: string; url: string };

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(o => !o);
    }
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, [toggle]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults([]); setSelected(0); }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        setResults(data.results ?? []);
        setSelected(0);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) {
      window.location.href = results[selected].url;
      setOpen(false);
    }
  }

  const TYPE_ICONS: Record<string, string> = { task: '◈', project: '⬟', instruction: '◎' };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', width: '100%', marginBottom: 8 }}
    >
      <span>🔍</span>
      <span style={{ flex: 1, textAlign: 'left' }}>Search… (⌘K)</span>
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, background: 'var(--surface)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search tasks, projects, instructions…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-primary)' }}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Searching…</span>}
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>ESC</kbd>
        </div>
        {results.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <Link key={r.id} href={r.url} onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', textDecoration: 'none', background: i === selected ? 'var(--surface-hover, rgba(0,0,0,0.04))' : 'transparent', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ fontSize: 16, minWidth: 20 }}>{TYPE_ICONS[r.type] ?? '◉'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.title}</div>
                  {r.subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.subtitle}</div>}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.type}</span>
              </Link>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No results for &quot;{query}&quot;</div>
        )}
        {query.length < 2 && (
          <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)' }}>Type at least 2 characters to search</div>
        )}
      </div>
    </div>
  );
}
