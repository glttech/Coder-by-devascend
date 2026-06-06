import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGithubCoords, userSafeErrorMessage } from '../githubClient.js';
import type { GithubClientError } from '../githubClient.js';

// ── resolveGithubCoords ────────────────────────────────────────────────────

describe('resolveGithubCoords — project has repoOwner + repoName', () => {
  test('uses project coords when both present', () => {
    const r = resolveGithubCoords('glttech', 'my-repo', null, 42);
    assert.deepEqual(r, { owner: 'glttech', repo: 'my-repo', prNumber: 42 });
  });

  test('uses project coords even when prUrl is also available', () => {
    const r = resolveGithubCoords('org-a', 'repo-a', 'https://github.com/org-b/repo-b/pull/99', 5);
    assert.deepEqual(r, { owner: 'org-a', repo: 'repo-a', prNumber: 5 });
  });

  test('uses project coords with underscore/dot names', () => {
    const r = resolveGithubCoords('my_org', 'my.repo', null, 1);
    assert.deepEqual(r, { owner: 'my_org', repo: 'my.repo', prNumber: 1 });
  });

  test('preserves the stored prNumber', () => {
    const r = resolveGithubCoords('org', 'repo', null, 1234);
    assert.ok(r !== null);
    assert.equal(r.prNumber, 1234);
  });
});

describe('resolveGithubCoords — missing project coords, falls back to prUrl', () => {
  test('parses full GitHub URL when repoOwner is null', () => {
    const r = resolveGithubCoords(null, 'repo', 'https://github.com/fallback-org/fallback-repo/pull/7', 7);
    assert.deepEqual(r, { owner: 'fallback-org', repo: 'fallback-repo', prNumber: 7 });
  });

  test('parses full GitHub URL when repoName is null', () => {
    const r = resolveGithubCoords('org', null, 'https://github.com/fallback-org/fallback-repo/pull/7', 7);
    assert.deepEqual(r, { owner: 'fallback-org', repo: 'fallback-repo', prNumber: 7 });
  });

  test('parses full GitHub URL when both are null', () => {
    const r = resolveGithubCoords(null, null, 'https://github.com/glttech/Coder-by-devascend/pull/39', 39);
    assert.deepEqual(r, { owner: 'glttech', repo: 'Coder-by-devascend', prNumber: 39 });
  });

  test('parses shorthand URL fallback', () => {
    const r = resolveGithubCoords(null, null, 'glttech/my-repo#12', 12);
    assert.deepEqual(r, { owner: 'glttech', repo: 'my-repo', prNumber: 12 });
  });

  test('parses empty-string owner as falsy — falls back to prUrl', () => {
    const r = resolveGithubCoords('', 'repo', 'https://github.com/url-org/url-repo/pull/3', 3);
    assert.deepEqual(r, { owner: 'url-org', repo: 'url-repo', prNumber: 3 });
  });
});

describe('resolveGithubCoords — returns null when no coords available', () => {
  test('null owner, null name, null prUrl → null', () => {
    assert.equal(resolveGithubCoords(null, null, null, 1), null);
  });

  test('null owner, null name, unparseable prUrl → null', () => {
    assert.equal(resolveGithubCoords(null, null, 'not-a-url', 1), null);
  });

  test('null owner, null name, empty prUrl → null', () => {
    assert.equal(resolveGithubCoords(null, null, '', 1), null);
  });

  test('undefined owner and name, no prUrl → null', () => {
    assert.equal(resolveGithubCoords(undefined, undefined, undefined, 5), null);
  });
});

// ── userSafeErrorMessage ───────────────────────────────────────────────────

describe('userSafeErrorMessage — returns user-safe strings', () => {
  const codes: GithubClientError['code'][] = [
    'RATE_LIMITED', 'NOT_FOUND', 'AUTH_REQUIRED', 'NETWORK_ERROR', 'PARSE_ERROR',
  ];

  for (const code of codes) {
    test(`${code} → non-empty string`, () => {
      const msg = userSafeErrorMessage(code);
      assert.equal(typeof msg, 'string');
      assert.ok(msg.length > 0);
    });
  }

  test('RATE_LIMITED message mentions rate limit', () => {
    assert.ok(userSafeErrorMessage('RATE_LIMITED').toLowerCase().includes('rate limit'));
  });

  test('NOT_FOUND message does not mention token', () => {
    assert.ok(!userSafeErrorMessage('NOT_FOUND').toLowerCase().includes('token'));
  });

  test('NETWORK_ERROR message does not expose internal paths', () => {
    const msg = userSafeErrorMessage('NETWORK_ERROR');
    assert.ok(!msg.includes('/'));
    assert.ok(!msg.includes('prisma'));
    assert.ok(!msg.includes('process.env'));
  });

  test('AUTH_REQUIRED is user-safe and does not expose env var names or token values', () => {
    const msg = userSafeErrorMessage('AUTH_REQUIRED');
    // Must be user-readable — mention GitHub access and admin action
    assert.ok(msg.toLowerCase().includes('github'));
    assert.ok(msg.toLowerCase().includes('admin') || msg.toLowerCase().includes('configured') || msg.toLowerCase().includes('access'));
    // Must not expose the env var name to end users
    assert.ok(!msg.includes('GITHUB_TOKEN'));
    // Must not look like a token value (40-char hex string)
    assert.ok(!/[0-9a-f]{40}/.test(msg));
  });

  test('PARSE_ERROR is safe for display', () => {
    const msg = userSafeErrorMessage('PARSE_ERROR');
    assert.ok(!msg.includes('stack'));
    assert.ok(!msg.includes('undefined'));
  });
});
