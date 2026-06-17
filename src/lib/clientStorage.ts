type StorageEntry<T> = { value: T; expiresAt?: number };

function isAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function fullKey(key: string): string {
  return `cda.${key}`;
}

export const clientStorage = {
  get<T>(key: string): T | null {
    if (!isAvailable()) return null;
    try {
      const raw = localStorage.getItem(fullKey(key));
      if (!raw) return null;
      const entry: StorageEntry<T> = JSON.parse(raw);
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        localStorage.removeItem(fullKey(key));
        return null;
      }
      return entry.value;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (!isAvailable()) return;
    try {
      const entry: StorageEntry<T> = { value };
      if (ttlMs) entry.expiresAt = Date.now() + ttlMs;
      localStorage.setItem(fullKey(key), JSON.stringify(entry));
    } catch {
      // quota exceeded or private mode — silently ignore
    }
  },

  remove(key: string): void {
    if (!isAvailable()) return;
    try {
      localStorage.removeItem(fullKey(key));
    } catch {}
  },

  clear(): void {
    if (!isAvailable()) return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('cda.')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};
