export default function MilestonesLoading() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 32, width: '40%', background: 'var(--border)', borderRadius: 6, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 100, background: 'var(--border)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    </div>
  );
}
