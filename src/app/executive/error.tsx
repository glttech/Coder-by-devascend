'use client';

export default function ExecutiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: 'var(--red)', marginBottom: '0.5rem' }}>
        Executive Dashboard failed to load
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: '1rem' }}>
        A database query failed. Check that the database is reachable and try again.
      </p>
      {error.digest && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace', marginBottom: '1rem' }}>
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          padding: '6px 16px',
          background: 'var(--blue)',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Try again
      </button>
    </div>
  );
}
