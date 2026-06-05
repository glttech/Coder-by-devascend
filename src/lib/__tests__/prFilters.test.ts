import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPRFilters,
  normaliseStateFilter,
  normaliseCIFilter,
} from '../prFilters.js';

// ── normaliseStateFilter ───────────────────────────────────────────────────

describe('normaliseStateFilter', () => {
  test('"open" → "open"', () => assert.equal(normaliseStateFilter('open'), 'open'));
  test('"merged" → "merged"', () => assert.equal(normaliseStateFilter('merged'), 'merged'));
  test('"closed" → "closed"', () => assert.equal(normaliseStateFilter('closed'), 'closed'));
  test('"all" → "all"', () => assert.equal(normaliseStateFilter('all'), 'all'));
  test('undefined → "all"', () => assert.equal(normaliseStateFilter(undefined), 'all'));
  test('unknown value → "all"', () => assert.equal(normaliseStateFilter('bogus'), 'all'));
  test('empty string → "all"', () => assert.equal(normaliseStateFilter(''), 'all'));
});

// ── normaliseCIFilter ──────────────────────────────────────────────────────

describe('normaliseCIFilter', () => {
  test('"success" → "success"', () => assert.equal(normaliseCIFilter('success'), 'success'));
  test('"failure" → "failure"', () => assert.equal(normaliseCIFilter('failure'), 'failure'));
  test('"pending" → "pending"', () => assert.equal(normaliseCIFilter('pending'), 'pending'));
  test('"neutral" → "neutral"', () => assert.equal(normaliseCIFilter('neutral'), 'neutral'));
  test('"unknown" → "unknown"', () => assert.equal(normaliseCIFilter('unknown'), 'unknown'));
  test('"all" → "all"', () => assert.equal(normaliseCIFilter('all'), 'all'));
  test('undefined → "all"', () => assert.equal(normaliseCIFilter(undefined), 'all'));
  test('garbage → "all"', () => assert.equal(normaliseCIFilter('???'), 'all'));
});

// ── buildPRFilters — no filters ────────────────────────────────────────────

describe('buildPRFilters — no active filters', () => {
  test('empty object when all "all"', () => {
    assert.deepEqual(buildPRFilters({ state: 'all', ci: 'all', q: '' }), {});
  });

  test('empty object when no keys provided', () => {
    assert.deepEqual(buildPRFilters({}), {});
  });

  test('empty object when q is whitespace', () => {
    assert.deepEqual(buildPRFilters({ q: '   ' }), {});
  });
});

// ── buildPRFilters — state filter ─────────────────────────────────────────

describe('buildPRFilters — state filter', () => {
  test('"open" → { state: "open" }', () => {
    assert.deepEqual(buildPRFilters({ state: 'open' }), { state: 'open' });
  });

  test('"merged" → { merged: true }', () => {
    assert.deepEqual(buildPRFilters({ state: 'merged' }), { merged: true });
  });

  test('"closed" → { state: "closed", merged: false }', () => {
    assert.deepEqual(buildPRFilters({ state: 'closed' }), { state: 'closed', merged: false });
  });

  test('"all" → empty (no state clause)', () => {
    assert.deepEqual(buildPRFilters({ state: 'all' }), {});
  });
});

// ── buildPRFilters — CI filter ────────────────────────────────────────────

describe('buildPRFilters — CI filter', () => {
  test('"success" → { ciStatus: "success" }', () => {
    assert.deepEqual(buildPRFilters({ ci: 'success' }), { ciStatus: 'success' });
  });

  test('"failure" → { ciStatus: "failure" }', () => {
    assert.deepEqual(buildPRFilters({ ci: 'failure' }), { ciStatus: 'failure' });
  });

  test('"pending" → { ciStatus: "pending" }', () => {
    assert.deepEqual(buildPRFilters({ ci: 'pending' }), { ciStatus: 'pending' });
  });

  test('"neutral" → { ciStatus: "neutral" }', () => {
    assert.deepEqual(buildPRFilters({ ci: 'neutral' }), { ciStatus: 'neutral' });
  });

  test('"unknown" → { ciStatus: null }', () => {
    assert.deepEqual(buildPRFilters({ ci: 'unknown' }), { ciStatus: null });
  });

  test('"all" → empty (no CI clause)', () => {
    assert.deepEqual(buildPRFilters({ ci: 'all' }), {});
  });
});

// ── buildPRFilters — text search ──────────────────────────────────────────

describe('buildPRFilters — text search', () => {
  test('non-empty q → title contains clause', () => {
    assert.deepEqual(buildPRFilters({ q: 'auth' }), {
      title: { contains: 'auth', mode: 'insensitive' },
    });
  });

  test('trims whitespace from q', () => {
    assert.deepEqual(buildPRFilters({ q: '  fix  ' }), {
      title: { contains: 'fix', mode: 'insensitive' },
    });
  });

  test('empty q → no clause', () => {
    assert.deepEqual(buildPRFilters({ q: '' }), {});
  });
});

// ── buildPRFilters — combined filters ─────────────────────────────────────

describe('buildPRFilters — combined filters', () => {
  test('state + ci → AND array', () => {
    const result = buildPRFilters({ state: 'open', ci: 'failure' });
    assert.ok('AND' in result);
    const and = (result as { AND: unknown[] }).AND;
    assert.equal(and.length, 2);
    assert.deepEqual(and[0], { state: 'open' });
    assert.deepEqual(and[1], { ciStatus: 'failure' });
  });

  test('state + q → AND array', () => {
    const result = buildPRFilters({ state: 'merged', q: 'dashboard' });
    assert.ok('AND' in result);
    const and = (result as { AND: unknown[] }).AND;
    assert.equal(and.length, 2);
    assert.deepEqual(and[0], { merged: true });
    assert.deepEqual(and[1], { title: { contains: 'dashboard', mode: 'insensitive' } });
  });

  test('ci + q → AND array', () => {
    const result = buildPRFilters({ ci: 'success', q: 'feat' });
    assert.ok('AND' in result);
    const and = (result as { AND: unknown[] }).AND;
    assert.equal(and.length, 2);
    assert.deepEqual(and[0], { ciStatus: 'success' });
    assert.deepEqual(and[1], { title: { contains: 'feat', mode: 'insensitive' } });
  });

  test('state + ci + q → AND with 3 clauses', () => {
    const result = buildPRFilters({ state: 'open', ci: 'failure', q: 'bug' });
    assert.ok('AND' in result);
    const and = (result as { AND: unknown[] }).AND;
    assert.equal(and.length, 3);
  });

  test('single active filter → flat clause (no AND wrapper)', () => {
    const result = buildPRFilters({ state: 'open', ci: 'all' });
    assert.ok(!('AND' in result));
    assert.deepEqual(result, { state: 'open' });
  });

  test('unknown CI + empty q → null ciStatus only', () => {
    const result = buildPRFilters({ ci: 'unknown', q: '' });
    assert.deepEqual(result, { ciStatus: null });
  });
});
