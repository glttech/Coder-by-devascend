import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRepositoryListParams,
  validateRepositoryBody,
  validateRepositoryPatch,
} from '../coder/repositoryParams.js';

// ── parseRepositoryListParams ────────────────────────────────────────────────

describe('parseRepositoryListParams — defaults', () => {
  test('defaults orgId to org_default', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(orgId, 'org_default');
  });

  test('defaults limit to 50', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(limit, 50);
  });

  test('enabled is undefined when absent', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(enabled, undefined);
  });

  test('cursor is undefined when absent', () => {
    const { cursor } = parseRepositoryListParams(new URLSearchParams());
    assert.equal(cursor, undefined);
  });
});

describe('parseRepositoryListParams — orgId', () => {
  test('passes custom orgId through', () => {
    const { orgId } = parseRepositoryListParams(new URLSearchParams('orgId=my-org'));
    assert.equal(orgId, 'my-org');
  });
});

describe('parseRepositoryListParams — enabled filter', () => {
  test('enabled=true parses to true', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=true'));
    assert.equal(enabled, true);
  });

  test('enabled=false parses to false', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=false'));
    assert.equal(enabled, false);
  });

  test('enabled=0 parses to false (non-"true" string)', () => {
    const { enabled } = parseRepositoryListParams(new URLSearchParams('enabled=0'));
    assert.equal(enabled, false);
  });
});

describe('parseRepositoryListParams — cursor', () => {
  test('passes cursor through', () => {
    const iso = '2026-06-21T00:00:00.000Z';
    const { cursor } = parseRepositoryListParams(new URLSearchParams(`cursor=${iso}`));
    assert.equal(cursor, iso);
  });
});

describe('parseRepositoryListParams — limit clamping', () => {
  test('accepts limit=1 (minimum valid)', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=1'));
    assert.equal(limit, 1);
  });

  test('accepts limit=100 (maximum valid)', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=100'));
    assert.equal(limit, 100);
  });

  test('clamps limit above 100 to 100', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=999'));
    assert.equal(limit, 100);
  });

  test('falls back to 50 on zero limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=0'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on negative limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=-10'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on non-numeric limit', () => {
    const { limit } = parseRepositoryListParams(new URLSearchParams('limit=abc'));
    assert.equal(limit, 50);
  });
});

// ── validateRepositoryBody ───────────────────────────────────────────────────

describe('validateRepositoryBody — valid input', () => {
  test('accepts valid owner and repo', () => {
    const result = validateRepositoryBody({ owner: 'octocat', repo: 'hello-world' });
    assert.equal(result.owner, 'octocat');
    assert.equal(result.repo, 'hello-world');
  });

  test('fullName is computed as owner/repo', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.fullName, 'myorg/myrepo');
  });

  test('name defaults to fullName when not provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.name, 'myorg/myrepo');
  });

  test('custom name is used when provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', name: 'My Repo' });
    assert.equal(result.name, 'My Repo');
  });

  test('defaultBranch defaults to main when not provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.defaultBranch, 'main');
  });

  test('custom defaultBranch is used when provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', defaultBranch: 'develop' });
    assert.equal(result.defaultBranch, 'develop');
  });

  test('private defaults to false', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.private, false);
  });

  test('private: true is accepted', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', private: true });
    assert.equal(result.private, true);
  });

  test('enabled defaults to true', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.enabled, true);
  });

  test('enabled: false is accepted', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', enabled: false });
    assert.equal(result.enabled, false);
  });

  test('description is included when provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo', description: 'A test repo' });
    assert.equal(result.description, 'A test repo');
  });

  test('description is undefined when not provided', () => {
    const result = validateRepositoryBody({ owner: 'myorg', repo: 'myrepo' });
    assert.equal(result.description, undefined);
  });

  test('whitespace is trimmed from owner and repo', () => {
    const result = validateRepositoryBody({ owner: '  myorg  ', repo: '  myrepo  ' });
    assert.equal(result.owner, 'myorg');
    assert.equal(result.repo, 'myrepo');
  });
});

describe('validateRepositoryBody — invalid input', () => {
  test('throws when body is null', () => {
    assert.throws(() => validateRepositoryBody(null), /body required/i);
  });

  test('throws when body is not an object', () => {
    assert.throws(() => validateRepositoryBody('string'), /body required/i);
  });

  test('throws when owner is missing', () => {
    assert.throws(() => validateRepositoryBody({ repo: 'myrepo' }), /owner is required/i);
  });

  test('throws when repo is missing', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'myorg' }), /repo is required/i);
  });

  test('throws when owner is empty string', () => {
    assert.throws(() => validateRepositoryBody({ owner: '   ', repo: 'myrepo' }), /owner is required/i);
  });

  test('throws when repo is empty string', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'myorg', repo: '   ' }), /repo is required/i);
  });

  test('throws when owner contains invalid characters', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'my org', repo: 'myrepo' }), /owner contains invalid characters/i);
  });

  test('throws when repo contains invalid characters', () => {
    assert.throws(() => validateRepositoryBody({ owner: 'myorg', repo: 'my/repo' }), /repo contains invalid characters/i);
  });
});

// ── validateRepositoryPatch ──────────────────────────────────────────────────

describe('validateRepositoryPatch — valid input', () => {
  test('returns empty object for empty body', () => {
    const patch = validateRepositoryPatch({});
    assert.deepEqual(patch, {});
  });

  test('updates name only', () => {
    const patch = validateRepositoryPatch({ name: 'New Name' });
    assert.equal(patch.name, 'New Name');
    assert.equal(patch.enabled, undefined);
    assert.equal(patch.defaultBranch, undefined);
  });

  test('updates enabled only', () => {
    const patch = validateRepositoryPatch({ enabled: false });
    assert.equal(patch.enabled, false);
    assert.equal(patch.name, undefined);
  });

  test('updates defaultBranch only', () => {
    const patch = validateRepositoryPatch({ defaultBranch: 'develop' });
    assert.equal(patch.defaultBranch, 'develop');
  });

  test('updates description only', () => {
    const patch = validateRepositoryPatch({ description: 'Updated description' });
    assert.equal(patch.description, 'Updated description');
  });

  test('coerces truthy enabled to boolean true', () => {
    const patch = validateRepositoryPatch({ enabled: 1 });
    assert.equal(patch.enabled, true);
  });

  test('coerces falsy enabled to boolean false', () => {
    const patch = validateRepositoryPatch({ enabled: 0 });
    assert.equal(patch.enabled, false);
  });

  test('empty string name becomes undefined', () => {
    const patch = validateRepositoryPatch({ name: '   ' });
    assert.equal(patch.name, undefined);
  });
});

describe('validateRepositoryPatch — invalid input', () => {
  test('throws when body is null', () => {
    assert.throws(() => validateRepositoryPatch(null), /body required/i);
  });

  test('throws when body is a string', () => {
    assert.throws(() => validateRepositoryPatch('bad'), /body required/i);
  });
});
