'use client';

export default function MilestonesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Failed to load milestones</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        {error.message || 'An unexpected error occurred while fetching milestones.'}
      </p>
      <button
        onClick={reset}
        className="btn btn-primary btn-sm"
      >
        Try again
      </button>
    </div>
  );
}
