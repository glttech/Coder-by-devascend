import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRepositoryListParams,
  validateRepositoryBody,
  validateRepositoryPatch,
} from '../coder/repositoryParams.js';

// ── parseRepositoryListParams ────────────────────────────────────────────────

describe('parseRepositoryListParams — orgId', () => {
  test('defaults to org_default when absent', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(orgId, 'org_default');
  });

  test('uses provided orgId', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams('orgId=my-org'));
    assert.equal(orgId, 'my-org');
  });
});

describe('parseRepositoryListParams — limit', () => {
  test('defaults to 50 when absent', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(limit, 50);
  });

  test('uses provided limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=20'));
    assert.equal(limit, 20);
  });

  test('clamps limit at 100', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=999'));
    assert.equal(limit, 100);
  });

  test('falls back to 50 on non-numeric limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=abc'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on zero limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=0'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on negative limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=-10'));
    assert.equal(limit, 50);
  });

  test('accepts limit=1 (minimum valid)', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=1'));
    assert.equal(limit, 1);
  });
});

describe('parseRepositoryListParams — enabled', () => {
  test('enabled is undefined when absent', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(enabled, undefined);
  });

  test('enabled=true parses to true', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=true'));
    assert.equal(enabled, true);
  });

  test('enabled=false parses to false', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=false'));
    assert.equal(enabled, false);
  });
});

describe('parseRepositoryListParams — cursor', () => {
  test('cursor is undefined when absent', () => {
    const { cursor } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(cursor, undefined);
  });

  test('cursor uses provided value', () => {
    const { cursor } = parseRepositoryListParams(
      new URLSearchParams('cursor=2026-06-21T00:00:00.000Z'),
    );
    assert.equal(cursor, '2026-06-21T00:00:00.000Z');
  });
});

// ── validateRepositoryBody ───────────────────────────────────────────────────

describe('validateRepositoryBody — valid input', () => {
  test('returns normalized body with all fields', () => {
    const result = validateRepositoryBody({
      owner: 'octocat',
      repo: 'my-project',
      defaultBranch: 'main',
      description: 'A great project',
      private: true,
      enabled: true,
    });
    assert.equal(result.owner, 'octocat');
    assert.equal(result.repo, 'my-project');
    assert.equal(result.fullName, 'octocat/my-project');
    assert.equal(result.name, 'octocat/my-project');
    assert.equal(result.defaultBranch, 'main');
    assert.equal(result.description, 'A great project');
    assert.equal(result.private, true);
    assert.equal(result.enabled, true);
  });

  test('uses custom name when provided', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar', name: 'My Repo' });
    assert.equal(result.name, 'My Repo');
  });

  test('falls back to owner/repo as name when name is empty string', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar', name: '' });
    assert.equal(result.name, 'foo/bar');
  });

  test('computes fullName as owner/repo', () => {
    const result = validateRepositoryBody({ owner: 'Alice', repo: 'Widget' });
    assert.equal(result.fullName, 'Alice/Widget');
  });

  test('defaults defaultBranch to main when absent', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar' });
    assert.equal(result.defaultBranch, 'main');
  });

  test('defaults enabled to true when absent', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar' });
    assert.equal(result.enabled, true);
  });

  test('respects enabled=false', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar', enabled: false });
    assert.equal(result.enabled, false);
  });

  test('description is undefined when absent', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar' });
    assert.equal(result.description, undefined);
  });

  test('description is undefined when empty string', () => {
    const result = validateRepositoryBody({ owner: 'foo', repo: 'bar', description: '   ' });
    assert.equal(result.description, undefined);
  });
});

describe('validateRepositoryBody — validation errors', () => {
  test('throws when body is null', () => {
    assert.throws(() => validateRepositoryBody(null), /body required/i);
  });

  test('throws when body is not an object', () => {
    assert.throws(() => validateRepositoryBody('string'), /body required/i);
  });

  test('throws when owner is missing', () => {
    assert.throws(() => validateRepositoryBody({ repo: 'bar' }), /owner is required/i);
  });

  test('throws when owner is empty string', () => {
    assert.throws(() => validateRepositoryBody({ owner: '', repo: 'bar' }), /owner is required/i);
  });

  test('throws when repo is missing', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'foo' }), /repo is required/i);
  });

  test('throws when repo is empty string', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'foo', repo: '' }), /repo is required/i);
  });

  test('throws when owner has invalid characters', () => {
    assert.throws(
      () => validateRepositoryBody({ owner: 'foo bar', repo: 'baz' }),
      /invalid characters/i,
    );
  });

  test('throws when repo has invalid characters', () => {
    assert.throws(
      () => validateRepositoryBody({ owner: 'foo', repo: 'bar baz' }),
      /invalid characters/i,
    );
  });
});

// ── validateRepositoryPatch ──────────────────────────────────────────────────

describe('validateRepositoryPatch', () => {
  test('returns empty patch when body has no recognized fields', () => {
    const patch = validateRepositoryPatch({ unknown: 'field' });
    assert.deepEqual(patch, {});
  });

  test('patches name', () => {
    const patch = validateRepositoryPatch({ name: 'New Name' });
    assert.equal(patch.name, 'New Name');
  });

  test('strips empty name to undefined', () => {
    const patch = validateRepositoryPatch({ name: '  ' });
    assert.equal(patch.name, undefined);
  });

  test('patches defaultBranch', () => {
    const patch = validateRepositoryPatch({ defaultBranch: 'develop' });
    assert.equal(patch.defaultBranch, 'develop');
  });

  test('patches description', () => {
    const patch = validateRepositoryPatch({ description: 'Updated' });
    assert.equal(patch.description, 'Updated');
  });

  test('patches enabled to false', () => {
    const patch = validateRepositoryPatch({ enabled: false });
    assert.equal(patch.enabled, false);
  });

  test('patches enabled to true', () => {
    const patch = validateRepositoryPatch({ enabled: true });
    assert.equal(patch.enabled, true);
  });

  test('throws when body is not an object', () => {
    assert.throws(() => validateRepositoryPatch(42), /body required/i);
  });
});
