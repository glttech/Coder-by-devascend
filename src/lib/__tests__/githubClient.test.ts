import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePRUrl } from '../githubClient.js';

// ── parsePRUrl ─────────────────────────────────────────────────────────────

describe('parsePRUrl — full GitHub URLs', () => {
  test('parses standard PR URL', () => {
    const r = parsePRUrl('https://github.com/glttech/Coder-by-devascend/pull/39');
    assert.deepEqual(r, { owner: 'glttech', repo: 'Coder-by-devascend', prNumber: 39 });
  });

  test('parses PR URL with trailing slash', () => {
    const r = parsePRUrl('https://github.com/glttech/my-repo/pull/1/');
    assert.deepEqual(r, { owner: 'glttech', repo: 'my-repo', prNumber: 1 });
  });

  test('parses PR URL with org that has dots', () => {
    const r = parsePRUrl('https://github.com/my.org/my.repo/pull/42');
    assert.deepEqual(r, { owner: 'my.org', repo: 'my.repo', prNumber: 42 });
  });

  test('parses PR URL with uppercase letters', () => {
    const r = parsePRUrl('https://github.com/MyOrg/MyRepo/pull/100');
    assert.deepEqual(r, { owner: 'MyOrg', repo: 'MyRepo', prNumber: 100 });
  });

  test('parses http (non-https) URL', () => {
    const r = parsePRUrl('http://github.com/org/repo/pull/5');
    assert.deepEqual(r, { owner: 'org', repo: 'repo', prNumber: 5 });
  });

  test('returns null for non-PR URL (issues)', () => {
    assert.equal(parsePRUrl('https://github.com/org/repo/issues/5'), null);
  });

  test('returns null for repo home URL', () => {
    assert.equal(parsePRUrl('https://github.com/org/repo'), null);
  });

  test('returns null for empty string', () => {
    assert.equal(parsePRUrl(''), null);
  });

  test('returns null for random text', () => {
    assert.equal(parsePRUrl('not a url'), null);
  });
});

describe('parsePRUrl — shorthand owner/repo#number', () => {
  test('parses shorthand format', () => {
    const r = parsePRUrl('glttech/Coder-by-devascend#39');
    assert.deepEqual(r, { owner: 'glttech', repo: 'Coder-by-devascend', prNumber: 39 });
  });

  test('parses shorthand with underscore repo name', () => {
    const r = parsePRUrl('my_org/my_repo#1');
    assert.deepEqual(r, { owner: 'my_org', repo: 'my_repo', prNumber: 1 });
  });

  test('parses shorthand with dot names', () => {
    const r = parsePRUrl('my.org/my.repo#7');
    assert.deepEqual(r, { owner: 'my.org', repo: 'my.repo', prNumber: 7 });
  });

  test('returns null for shorthand missing #', () => {
    assert.equal(parsePRUrl('org/repo/39'), null);
  });

  test('returns null for shorthand with non-numeric PR number', () => {
    assert.equal(parsePRUrl('org/repo#abc'), null);
  });

  test('trims whitespace before parsing', () => {
    const r = parsePRUrl('  glttech/repo#5  ');
    assert.deepEqual(r, { owner: 'glttech', repo: 'repo', prNumber: 5 });
  });
});

describe('parsePRUrl — prNumber is always a number', () => {
  test('prNumber is an integer, not a string', () => {
    const r = parsePRUrl('https://github.com/org/repo/pull/42');
    assert.ok(r !== null);
    assert.equal(typeof r.prNumber, 'number');
    assert.equal(r.prNumber, 42);
  });

  test('large PR numbers parse correctly', () => {
    const r = parsePRUrl('https://github.com/org/repo/pull/9999');
    assert.ok(r !== null);
    assert.equal(r.prNumber, 9999);
  });
});

// ── summariseCIStatus (pure logic, mirrored) ──────────────────────────────

type Conclusion = string | null;

function summariseCIStatus(checkRuns: { conclusion: Conclusion }[]): string {
  if (checkRuns.length === 0) return 'neutral';
  const conclusions = checkRuns.map((r) => r.conclusion ?? 'pending');
  if (conclusions.some((c) => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure';
  if (conclusions.every((c) => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success';
  return 'pending';
}

describe('summariseCIStatus', () => {
  test('empty check runs → neutral', () => {
    assert.equal(summariseCIStatus([]), 'neutral');
  });

  test('all success → success', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'success' }, { conclusion: 'success' }]), 'success');
  });

  test('success + skipped → success', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'success' }, { conclusion: 'skipped' }]), 'success');
  });

  test('any failure → failure', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'success' }, { conclusion: 'failure' }]), 'failure');
  });

  test('timed_out → failure', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'timed_out' }]), 'failure');
  });

  test('cancelled → failure', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'cancelled' }]), 'failure');
  });

  test('null conclusion (in_progress) → pending', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'success' }, { conclusion: null }]), 'pending');
  });

  test('all skipped → success', () => {
    assert.equal(summariseCIStatus([{ conclusion: 'skipped' }]), 'success');
  });
});
