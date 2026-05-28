import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeStateVersion, StateVersionInput } from '../stateVersion.js';

const baseInput: StateVersionInput = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  taskId: 'bbbbbbbb-0000-0000-0000-000000000002',
  title: 'Fix the login bug',
  body: 'The login flow crashes on invalid email.',
  status: 'draft',
  approvedBy: null,
  approvalNote: null,
  blockedReason: null,
  completedNotes: null,
};

describe('computeStateVersion', () => {
  test('same input produces the same hash (deterministic)', () => {
    const h1 = computeStateVersion(baseInput);
    const h2 = computeStateVersion({ ...baseInput });
    assert.equal(h1, h2, 'identical inputs must produce identical hashes');
  });

  test('status change produces a different hash', () => {
    const h1 = computeStateVersion(baseInput);
    const h2 = computeStateVersion({ ...baseInput, status: 'approved' });
    assert.notEqual(h1, h2, 'changing status must change the hash');
  });

  test('title change produces a different hash', () => {
    const h1 = computeStateVersion(baseInput);
    const h2 = computeStateVersion({ ...baseInput, title: 'Updated title' });
    assert.notEqual(h1, h2, 'changing title must change the hash');
  });

  test('null vs undefined optional fields are treated the same (null-normalised)', () => {
    const withUndefined = computeStateVersion({ ...baseInput, approvedBy: undefined });
    const withNull = computeStateVersion({ ...baseInput, approvedBy: null });
    assert.equal(withUndefined, withNull, 'undefined and null optional fields should produce the same hash');
  });

  test('stale detection: matching stored hash is not stale', () => {
    const stored = computeStateVersion(baseInput);
    const current = computeStateVersion(baseInput);
    assert.equal(stored === current, true, 'same data should not be stale');
  });

  test('stale detection: different stored hash indicates stale', () => {
    const stored = computeStateVersion(baseInput);
    const current = computeStateVersion({ ...baseInput, status: 'executing' });
    assert.notEqual(stored, current, 'changed data should be detected as stale');
  });

  test('output is a 64-character hex string (SHA-256)', () => {
    const hash = computeStateVersion(baseInput);
    assert.match(hash, /^[0-9a-f]{64}$/, 'hash should be a 64-char lowercase hex string');
  });
});
