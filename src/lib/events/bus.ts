type EventCallback = (event: Record<string, unknown>) => void;

const subscribers = new Map<string, Set<EventCallback>>();

export function publish(channel: string, event: Record<string, unknown>): void {
  const subs = subscribers.get(channel);
  if (!subs) return;
  for (const cb of subs) {
    try { cb(event); } catch { /* ignore */ }
  }
}

export function subscribe(channel: string, cb: EventCallback): () => void {
  if (!subscribers.has(channel)) subscribers.set(channel, new Set());
  subscribers.get(channel)!.add(cb);
  return () => {
    subscribers.get(channel)?.delete(cb);
    if (subscribers.get(channel)?.size === 0) subscribers.delete(channel);
  };
}
