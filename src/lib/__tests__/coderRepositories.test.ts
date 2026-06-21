import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRepositoryListParams,
  validateRepositoryBody,
  validateRepositoryPatch,
} from '../coder/repositoryParams.js';

// ---------------------------------------------------------------------------
// parseRepositoryListParams
// ---------------------------------------------------------------------------

describe('parseRepositoryListParams — orgId', () => {
  test('defaults to org_default when absent', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(orgId, 'org_default');
  });

  test('passes custom orgId through', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams('orgId=org_acme'));
    assert.equal(orgId, 'org_acme');
  });
});

describe('parseRepositoryListParams — enabled', () => {
  test('enabled is undefined when absent', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(enabled, undefined);
  });

  test('enabled=true parses to boolean true', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=true'));
    assert.equal(enabled, true);
  });

  test('enabled=false parses to boolean false', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=false'));
    assert.equal(enabled, false);
  });

  test('enabled=1 parses to false (not exactly "true")', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=1'));
    assert.equal(enabled, false);
  });
});

describe('parseRepositoryListParams — limit', () => {
  test('defaults to 50 when absent', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(limit, 50);
  });

  test('accepts a valid limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=25'));
    assert.equal(limit, 25);
  });

  test('caps limit at 100', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=999'));
    assert.equal(limit, 100);
  });

  test('clamps limit to 1 minimum', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=0'));
    assert.equal(limit, 1);
  });

  test('clamps negative limit to 1', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=-5'));
    assert.equal(limit, 1);
  });
});

describe('parseRepositoryListParams — cursor', () => {
  test('cursor is undefined when absent', () => {
    const { cursor } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(cursor, undefined);
  });

  test('passes an ISO cursor through', () => {
    const iso = '2026-06-21T00:00:00.000Z';
    const { cursor } = parseRepositoryListParams(new URLSearchParams(`cursor=${iso}`));
    assert.equal(cursor, iso);
  });
});

// ---------------------------------------------------------------------------
// validateRepositoryBody
// ---------------------------------------------------------------------------

describe('validateRepositoryBody — valid input', () => {
  test('returns expected shape for minimal valid input', () => {
    const result = validateRepositoryBody({ owner: 'octocat', repo: 'hello-world' });
    assert.equal(result.owner, 'octocat');
    assert.equal(result.repo, 'hello-world');
    assert.equal(result.fullName, 'octocat/hello-world');
    assert.equal(result.defaultBranch, 'main');
    assert.equal(result.private, false);
    assert.equal(result.enabled, true);
  });

  test('auto-generates name from owner/repo when name is absent', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.name, 'myorg/myrepo');
  });

  test('uses provided name when given', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', name: 'My Repo' });
    assert.equal(result.name, 'My Repo');
  });

  test('lowercases owner and repo', () => {
    const result = validateRepositoryBody({ owner: 'MyOrg', repo: 'MyRepo' });
    assert.equal(result.owner, 'myorg');
    assert.equal(result.repo, 'myrepo');
  });

  test('computes fullName from lowercased owner/repo', () => {
    const result = validateRepositoryBody({ owner: 'MyOrg', repo: 'MyRepo' });
    assert.equal(result.fullName, 'myorg/myrepo');
  });

  test('uses custom defaultBranch when provided', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', defaultBranch: 'develop' });
    assert.equal(result.defaultBranch, 'develop');
  });

  test('falls back to "main" when defaultBranch is empty string', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', defaultBranch: '' });
    assert.equal(result.defaultBranch, 'main');
  });

  test('sets private=true when passed', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', private: true });
    assert.equal(result.private, true);
  });

  test('sets enabled=false when passed', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', enabled: false });
    assert.equal(result.enabled, false);
  });

  test('strips description to undefined when empty string', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', description: '' });
    assert.equal(result.description, undefined);
  });

  test('passes description through when non-empty', () => {
    const result = validateRepositoryBody({ owner: 'x', repo: 'y', description: 'My desc' });
    assert.equal(result.description, 'My desc');
  });
});

describe('validateRepositoryBody — invalid input', () => {
  test('throws when body is null', () => {
    assert.throws(() => validateRepositoryBody(null), /body required/i);
  });

  test('throws when body is a string', () => {
    assert.throws(() => validateRepositoryBody('not-an-object'), /body required/i);
  });

  test('throws when owner is missing', () => {
    assert.throws(() => validateRepositoryBody({ repo: 'hello' }), /owner is required/i);
  });

  test('throws when repo is missing', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'octocat' }), /repo is required/i);
  });

  test('throws when owner contains invalid characters', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'my org', repo: 'hello' }), /invalid characters/i);
  });

  test('throws when repo contains invalid characters', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'myorg', repo: 'hello world' }), /invalid characters/i);
  });
});

// ---------------------------------------------------------------------------
// validateRepositoryPatch
// ---------------------------------------------------------------------------

describe('validateRepositoryPatch', () => {
  test('returns empty patch when body is empty object', () => {
    const patch = validateRepositoryPatch({});
    assert.deepEqual(patch, {});
  });

  test('patches name when provided', () => {
    const patch = validateRepositoryPatch({ name: 'New Name' });
    assert.equal(patch.name, 'New Name');
  });

  test('patches defaultBranch when provided', () => {
    const patch = validateRepositoryPatch({ defaultBranch: 'develop' });
    assert.equal(patch.defaultBranch, 'develop');
  });

  test('patches enabled=false', () => {
    const patch = validateRepositoryPatch({ enabled: false });
    assert.equal(patch.enabled, false);
  });

  test('patches enabled=true', () => {
    const patch = validateRepositoryPatch({ enabled: true });
    assert.equal(patch.enabled, true);
  });

  test('patches description when provided', () => {
    const patch = validateRepositoryPatch({ description: 'My repo' });
    assert.equal(patch.description, 'My repo');
  });

  test('throws when body is null', () => {
    assert.throws(() => validateRepositoryPatch(null), /body required/i);
  });

  test('ignores non-string name (does not add to patch)', () => {
    const patch = validateRepositoryPatch({ name: 42 });
    assert.equal(patch.name, undefined);
  });

  test('trims whitespace from name', () => {
    const patch = validateRepositoryPatch({ name: '  My Repo  ' });
    assert.equal(patch.name, 'My Repo');
  });

  test('sets name to undefined when blank string after trim', () => {
    const patch = validateRepositoryPatch({ name: '   ' });
    assert.equal(patch.name, undefined);
  });
});
