'use client';
import { useEffect, useRef, useCallback } from 'react';

type Handler = (event: Record<string, unknown>) => void;

export function useEventStream(channel: string, onEvent: Handler) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connectRef = useRef<() => void>();

  const connect = useCallback(() => {
    const es = new EventSource(`/api/events?channel=${encodeURIComponent(channel)}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handlerRef.current(data);
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(() => connectRef.current?.(), 3_000);
    };

    return () => es.close();
  }, [channel]);

  connectRef.current = connect;

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
}
