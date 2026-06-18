import { PageHeader } from '@/components/ui/PageHeader';
import MemorySearchBox from './MemorySearchBox';

export const dynamic = 'force-dynamic';

const EXAMPLE_QUERIES = [
  'What did we build last week?',
  'Which PR changed auth?',
  'What migrations were added?',
  'What bugs are still open?',
  'What is pending before production?',
  'Show all security changes',
];

export default function MemoryPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader
        title="Repository Memory"
        subtitle="Search across all PRs, tasks, audit logs, and execution traces"
      />

      {/* Search box — client component for interactivity */}
      <MemorySearchBox />

      {/* Example queries */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
          Try asking
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLE_QUERIES.map((query) => (
            <button
              key={query}
              data-memory-example={query}
              style={{
                fontSize: '0.78rem',
                padding: '6px 14px',
                borderRadius: 20,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {query}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 40, padding: '16px 20px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
          What this searches
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
          {[
            ['PRs', 'Title, body, author, branch — all indexed GitHub PRs'],
            ['Tasks', 'Title and instruction text — all governance tasks'],
            ['Audit logs', 'All governance events with their details'],
            ['Traces', 'Execution trace decisions, role keys, risk scores'],
          ].map(([type, desc]) => (
            <div key={type} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--blue)', minWidth: 70 }}>{type}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
