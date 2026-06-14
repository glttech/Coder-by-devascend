export default function BoardLoading() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 16,
        padding: '20px 24px',
        alignItems: 'start',
        overflowX: 'auto',
      }}
    >
      {[...Array(4)].map((_, colIdx) => (
        <div
          key={colIdx}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            minHeight: 200,
          }}
        >
          {/* Column header skeleton */}
          <div
            className="animate-pulse"
            style={{
              height: 32,
              background: '#e5e7eb',
              borderRadius: 6,
              marginBottom: 12,
            }}
          />

          {/* Card skeletons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(3)].map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="animate-pulse"
                style={{
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '85%' }} />
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 4, width: '50%' }} />
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 4, width: '65%' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
