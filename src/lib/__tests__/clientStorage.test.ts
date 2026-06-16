import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Mock localStorage for Node.js test environment
const store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => { delete store[k]; }); },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};
globalThis.localStorage = mockStorage;
// Also mock window so isAvailable() returns true
(globalThis as Record<string, unknown>).window = { localStorage: mockStorage };

// Use createRequire so the mocks above are in place before module executes
const _require = createRequire(import.meta.url);
const { clientStorage } = _require('../clientStorage') as typeof import('../clientStorage');

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
    store['other.key'] = 'untouched';
    clientStorage.clear();
    assert.equal(clientStorage.get('a'), null);
    assert.equal(clientStorage.get('b'), null);
    assert.equal(store['other.key'], 'untouched');
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

  test('corrupted JSON returns null', () => {
    store['cda.bad'] = 'not-json{{';
    assert.equal(clientStorage.get('bad'), null);
  });

  test('keys are namespaced with cda. prefix', () => {
    clientStorage.set('mykey', 'val');
    assert.ok('cda.mykey' in store);
    assert.ok(!('mykey' in store));
  });
});
