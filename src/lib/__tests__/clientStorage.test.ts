import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js test environment
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => { delete store[k]; }); },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
} as Storage;
// Also mock window so isAvailable() returns true
(globalThis as Record<string, unknown>).window = { localStorage: globalThis.localStorage };

// Import after mocking
const { clientStorage } = await import('../clientStorage.js');

describe('clientStorage', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => { delete store[k]; });
  });

  test('set and get a value', () => {
    clientStorage.set('test', 42);
    assert.equal(clientStorage.get('test'), 42);
  });

  test('returns null for missing key', () => {
    assert.equal(clientStorage.get('missing'), null);
  });

  test('remove deletes the key', () => {
    clientStorage.set('toRemove', 'hello');
    clientStorage.remove('toRemove');
    assert.equal(clientStorage.get('toRemove'), null);
  });

  test('clear removes all cda. prefixed keys', () => {
    clientStorage.set('a', 1);
    clientStorage.set('b', 2);
    clientStorage.clear();
    assert.equal(clientStorage.get('a'), null);
    assert.equal(clientStorage.get('b'), null);
  });

  test('expired entry returns null', async () => {
    clientStorage.set('expiring', 'soon', 1); // 1ms TTL
    await new Promise(r => setTimeout(r, 10));
    assert.equal(clientStorage.get('expiring'), null);
  });

  test('non-expired entry still returns value', () => {
    clientStorage.set('lasting', 'here', 60_000);
    assert.equal(clientStorage.get('lasting'), 'here');
  });
});
