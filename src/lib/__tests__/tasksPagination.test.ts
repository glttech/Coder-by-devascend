/**
 * Tests for GET /api/tasks pagination logic.
 * Exercises the limit clamping and cursor-based pagination helpers extracted
 * from the route handler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers (mirrors the logic in /api/tasks route) ──────────────────────────

function resolveLimit(raw: string | null, defaultLimit = 50, maxLimit = 200): number {
  const parsed = parseInt(raw ?? String(defaultLimit), 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

function buildCursorClause(cursor: string | null): { lt: Date } | undefined {
  if (!cursor) return undefined;
  const d = new Date(cursor);
  if (isNaN(d.getTime())) return undefined;
  return { lt: d };
}

function buildNextCursor<T extends { createdAt: Date }>(items: T[], limit: number): string | null {
  if (items.length < limit) return null;
  return items[items.length - 1].createdAt.toISOString();
}

// ── resolveLimit ──────────────────────────────────────────────────────────────

describe('tasksPagination — resolveLimit', () => {
  it('defaults to 50 when null', () => {
    assert.equal(resolveLimit(null), 50);
  });

  it('returns provided value when valid', () => {
    assert.equal(resolveLimit('25'), 25);
  });

  it('clamps to maxLimit (200) when above', () => {
    assert.equal(resolveLimit('500'), 200);
  });

  it('uses default for non-numeric string', () => {
    assert.equal(resolveLimit('abc'), 50);
  });

  it('uses default for zero', () => {
    assert.equal(resolveLimit('0'), 50);
  });

  it('uses default for negative number', () => {
    assert.equal(resolveLimit('-5'), 50);
  });

  it('returns exactly maxLimit when at boundary', () => {
    assert.equal(resolveLimit('200'), 200);
  });

  it('respects custom default and max', () => {
    assert.equal(resolveLimit(null, 10, 100), 10);
    assert.equal(resolveLimit('200', 10, 100), 100);
  });
});

// ── buildCursorClause ─────────────────────────────────────────────────────────

describe('tasksPagination — buildCursorClause', () => {
  it('returns undefined for null cursor', () => {
    assert.equal(buildCursorClause(null), undefined);
  });

  it('returns a lt clause for valid ISO date string', () => {
    const iso = '2026-06-19T12:00:00.000Z';
    const clause = buildCursorClause(iso);
    assert.ok(clause !== undefined);
    assert.ok(clause!.lt instanceof Date);
    assert.equal(clause!.lt.toISOString(), iso);
  });

  it('returns undefined for invalid date string', () => {
    assert.equal(buildCursorClause('not-a-date'), undefined);
  });

  it('handles epoch zero correctly', () => {
    const clause = buildCursorClause(new Date(0).toISOString());
    assert.ok(clause !== undefined);
    assert.equal(clause!.lt.getTime(), 0);
  });
});

// ── buildNextCursor ───────────────────────────────────────────────────────────

describe('tasksPagination — buildNextCursor', () => {
  function makeTask(createdAt: string) {
    return { id: 'x', createdAt: new Date(createdAt) };
  }

  it('returns null when fewer items than limit (last page)', () => {
    const items = [makeTask('2026-06-19T10:00:00Z'), makeTask('2026-06-19T09:00:00Z')];
    assert.equal(buildNextCursor(items, 50), null);
  });

  it('returns cursor from last item when full page returned', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTask(new Date(Date.now() - i * 1000).toISOString()),
    );
    const cursor = buildNextCursor(items, 50);
    assert.ok(cursor !== null);
    assert.equal(cursor, items[49].createdAt.toISOString());
  });

  it('returns null for empty page', () => {
    assert.equal(buildNextCursor([], 50), null);
  });

  it('returns null when items < limit by 1', () => {
    const items = Array.from({ length: 49 }, (_, i) =>
      makeTask(new Date(Date.now() - i * 1000).toISOString()),
    );
    assert.equal(buildNextCursor(items, 50), null);
  });
});

// ── github-prs pagination (same helpers, different defaults) ──────────────────

describe('githubPrsPagination — resolveLimit', () => {
  it('defaults to 100 for PR list', () => {
    assert.equal(resolveLimit(null, 100, 500), 100);
  });

  it('clamps to 500 for PR list', () => {
    assert.equal(resolveLimit('1000', 100, 500), 500);
  });
});
