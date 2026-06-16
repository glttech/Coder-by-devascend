import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageParams, buildPageResult } from '../pagination.js';

// ── parsePageParams ────────────────────────────────────────────────────────

describe('parsePageParams — defaults', () => {
  test('returns take=25 when no take param provided', () => {
    const params = new URLSearchParams();
    const { take } = parsePageParams(params);
    assert.equal(take, 25);
  });

  test('caps take at 100 when value exceeds maximum', () => {
    const params = new URLSearchParams({ take: '500' });
    const { take } = parsePageParams(params);
    assert.equal(take, 100);
  });

  test('passes cursor through unchanged', () => {
    const params = new URLSearchParams({ cursor: 'abc123' });
    const { cursor } = parsePageParams(params);
    assert.equal(cursor, 'abc123');
  });

  test('cursor is undefined when not provided', () => {
    const params = new URLSearchParams();
    const { cursor } = parsePageParams(params);
    assert.equal(cursor, undefined);
  });
});

// ── buildPageResult ────────────────────────────────────────────────────────

describe('buildPageResult — nextCursor present', () => {
  test('returns nextCursor when rows exceed take', () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({ id: `id-${i}`, value: i }));
    const result = buildPageResult(rows, 25);
    assert.equal(result.nextCursor, 'id-25');
    assert.equal(result.items.length, 25);
  });
});

describe('buildPageResult — no nextCursor', () => {
  test('nextCursor is null when rows are fewer than take', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}`, value: i }));
    const result = buildPageResult(rows, 25);
    assert.equal(result.nextCursor, null);
    assert.equal(result.items.length, 10);
  });
});
