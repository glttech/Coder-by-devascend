'use client';
import { useState } from 'react';
import { useEventStream } from '@/hooks/useEventStream';

export default function LiveStatusBanner({ taskId }: { taskId: string }) {
  const [lastEvent, setLastEvent] = useState<string>('');

  useEventStream('runs', (event) => {
    if (event.type === 'run.updated') {
      setLastEvent(`Agent run updated: ${event.status}`);
      setTimeout(() => setLastEvent(''), 5_000);
    }
  });

  if (!lastEvent) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      background: 'var(--blue)', color: '#fff',
      padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      animation: 'fadeIn 0.3s ease',
    }}>
      {lastEvent}
    </div>
  );
}
