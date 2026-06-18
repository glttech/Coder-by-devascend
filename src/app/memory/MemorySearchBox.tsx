'use client';

import { useState, useCallback, useTransition } from 'react';
import type { MemoryResult, QueryIntent } from '@/lib/memorySearch';

const TYPE_COLOR: Record<string, string> = {
  pr:        'var(--blue)',
  task:      'var(--purple)',
  audit_log: 'var(--amber)',
  trace:     'var(--teal, #14b8a6)',
  incident:  'var(--red)',
};

const TYPE_LABEL: Record<string, string> = {
  pr:        'PR',
  task:      'Task',
  audit_log: 'Audit',
  trace:     'Trace',
  incident:  'Incident',
};

const INTENT_BANNER: Partial<Record<QueryIntent, string>> = {
  recent_features: '✦ Showing feature additions',
  auth_changes:    '⚠ Showing auth-related changes',
  migrations:      '⬡ Showing database migrations',
  bugs:            '⚑ Showing bug-related items',
  pending:         '◷ Showing pending / open items',
  security:        '⚠ Showing security changes',
  deployments:     '▶ Showing deployments',
};

interface SearchResponse {
  results: MemoryResult[];
  total: number;
  query: string;
  intent: QueryIntent;
  llmSummary?: string;
}

export default function MemorySearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = useCallback((query: string) => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '40' });
        const res = await fetch(`/api/memory/search?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data: SearchResponse = await res.json();
        setResults(data);
      } catch {
        setError('Search failed. Please try again.');
        setResults(null);
      }
    });
  }, []);

  function handleInput(value: string) {
    setQ(value);
    // Debounce via a simple timeout (no external dep)
    clearTimeout((window as typeof window & { _memorySearchTimer?: ReturnType<typeof setTimeout> })._memorySearchTimer);
    (window as typeof window & { _memorySearchTimer?: ReturnType<typeof setTimeout> })._memorySearchTimer = setTimeout(() => search(value), 280);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      clearTimeout((window as typeof window & { _memorySearchTimer?: ReturnType<typeof setTimeout> })._memorySearchTimer);
      search(q);
    }
  }

  return (
    <div>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={q}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your repo history…"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px 12px 44px',
            fontSize: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none',
        }}>
          {isPending ? '◌' : '⌕'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12, color: 'var(--red)', fontSize: '0.82rem' }}>{error}</div>
      )}

      {/* Results */}
      {results && (
        <div style={{ marginTop: 20 }}>
          {/* Intent banner */}
          {results.intent !== 'general' && INTENT_BANNER[results.intent] && (
            <div style={{
              fontSize: '0.75rem', padding: '5px 12px', marginBottom: 12,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-muted)', display: 'inline-block',
            }}>
              {INTENT_BANNER[results.intent]}
            </div>
          )}

          {/* LLM summary (only shown when feature flag enabled) */}
          {results.llmSummary && (
            <div style={{
              marginBottom: 16, padding: '12px 16px',
              background: 'color-mix(in srgb, var(--blue) 8%, var(--surface))',
              border: '1px solid color-mix(in srgb, var(--blue) 30%, var(--border))',
              borderRadius: 8, fontSize: '0.85rem', color: 'var(--text)',
              lineHeight: 1.6,
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--blue)', fontWeight: 600, marginBottom: 4 }}>
                AI SUMMARY
              </div>
              {results.llmSummary}
            </div>
          )}

          {/* Result count */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            {results.total === 0
              ? 'No results found'
              : `${results.total} result${results.total !== 1 ? 's' : ''} for "${results.query}"`}
          </div>

          {/* Result list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.results.map((result) => (
              <a
                key={result.id}
                href={result.url}
                target={result.url.startsWith('http') ? '_blank' : undefined}
                rel={result.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${TYPE_COLOR[result.type] ?? 'var(--text-muted)'}`,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Type badge */}
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    color: TYPE_COLOR[result.type] ?? 'var(--text-muted)',
                    background: `color-mix(in srgb, ${TYPE_COLOR[result.type] ?? 'var(--text-muted)'} 12%, transparent)`,
                    padding: '2px 6px', borderRadius: 4,
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {TYPE_LABEL[result.type] ?? result.type}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title */}
                    <div style={{
                      fontSize: '0.88rem', fontWeight: 500, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {result.title}
                    </div>

                    {/* Subtitle */}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {result.subtitle}
                    </div>

                    {/* Excerpt */}
                    {result.excerpt && (
                      <div style={{
                        fontSize: '0.75rem', color: 'var(--text-muted)',
                        marginTop: 4, fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {result.excerpt}
                      </div>
                    )}

                    {/* Citations */}
                    {result.citations.length > 0 && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                        {result.citations.map((c) => (
                          <span key={c.label} style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 600 }}>{c.label}:</span> {c.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  {result.date && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>

          {results.total > results.results.length && (
            <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Showing top {results.results.length} of {results.total} results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
