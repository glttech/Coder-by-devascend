import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageParams, buildPageResult } from '../pagination.js';

// ── parsePageParams ─────────────────────────────────────────────────────────

describe('parsePageParams — defaults', () => {
  test('returns take=25 when limit is not provided', () => {
    const params = new URLSearchParams();
    const result = parsePageParams(params);
    assert.equal(result.take, 25);
  });

  test('returns order=desc when order is not provided', () => {
    const params = new URLSearchParams();
    const result = parsePageParams(params);
    assert.equal(result.order, 'desc');
  });

  test('returns cursor=undefined when cursor is not provided', () => {
    const params = new URLSearchParams();
    const result = parsePageParams(params);
    assert.equal(result.cursor, undefined);
  });
});

describe('parsePageParams — custom values', () => {
  test('parses limit parameter', () => {
    const params = new URLSearchParams({ limit: '10' });
    const result = parsePageParams(params);
    assert.equal(result.take, 10);
  });

  test('caps take at 100', () => {
    const params = new URLSearchParams({ limit: '999' });
    const result = parsePageParams(params);
    assert.equal(result.take, 100);
  });

  test('exactly 100 is allowed (not capped further)', () => {
    const params = new URLSearchParams({ limit: '100' });
    const result = parsePageParams(params);
    assert.equal(result.take, 100);
  });

  test('parses asc order', () => {
    const params = new URLSearchParams({ order: 'asc' });
    const result = parsePageParams(params);
    assert.equal(result.order, 'asc');
  });

  test('parses cursor parameter', () => {
    const params = new URLSearchParams({ cursor: 'some-cursor-id' });
    const result = parsePageParams(params);
    assert.equal(result.cursor, 'some-cursor-id');
  });

  test('falls back to 25 for non-numeric limit', () => {
    const params = new URLSearchParams({ limit: 'abc' });
    const result = parsePageParams(params);
    assert.equal(result.take, 25);
  });
});

// ── buildPageResult ─────────────────────────────────────────────────────────

describe('buildPageResult — with more rows than take', () => {
  test('returns nextCursor equal to id of last item in slice', () => {
    const rows = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
    const result = buildPageResult(rows, 2);
    assert.equal(result.nextCursor, 'b');
    assert.deepEqual(result.items, [{ id: 'a' }, { id: 'b' }]);
  });

  test('slices items to take length when extra row present', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i}` }));
    const result = buildPageResult(rows, 10);
    assert.equal(result.items.length, 10);
    assert.equal(result.nextCursor, 'id-9');
  });
});

describe('buildPageResult — with fewer or equal rows than take', () => {
  test('returns nextCursor=null when rows === take', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const result = buildPageResult(rows, 2);
    assert.equal(result.nextCursor, null);
    assert.deepEqual(result.items, rows);
  });

  test('returns nextCursor=null when rows < take', () => {
    const rows = [{ id: 'x' }];
    const result = buildPageResult(rows, 25);
    assert.equal(result.nextCursor, null);
    assert.equal(result.items.length, 1);
  });

  test('returns nextCursor=null for empty rows', () => {
    const result = buildPageResult([], 25);
    assert.equal(result.nextCursor, null);
    assert.equal(result.items.length, 0);
  });
});
