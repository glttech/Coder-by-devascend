import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure-function mirrors of POST/PATCH /api/projects validation logic.

const REPO_IDENT_RE = /^[a-zA-Z0-9_.-]+$/;

function validateProject(body: Record<string, unknown>, requireName = true): string[] {
  const { name, description, repoOwner, repoName, defaultBranch } = body;
  const errors: string[] = [];

  if (requireName) {
    if (!name || typeof name !== 'string' || (name as string).trim().length === 0) {
      errors.push('name is required');
    } else if ((name as string).length > 200) {
      errors.push('name must be 200 characters or fewer');
    }
  } else if (name !== undefined) {
    if (typeof name !== 'string' || (name as string).trim().length === 0) errors.push('name must be a non-empty string');
    else if ((name as string).length > 200) errors.push('name must be 200 characters or fewer');
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') errors.push('description must be a string');
    else if ((description as string).length > 2000) errors.push('description must be 2000 characters or fewer');
  }

  if (repoOwner !== undefined && repoOwner !== null) {
    if (typeof repoOwner !== 'string' || (repoOwner as string).trim().length === 0) {
      errors.push('repoOwner must be a non-empty string');
    } else if (!REPO_IDENT_RE.test((repoOwner as string).trim())) {
      errors.push('repoOwner contains invalid characters');
    }
  }

  if (repoName !== undefined && repoName !== null) {
    if (typeof repoName !== 'string' || (repoName as string).trim().length === 0) {
      errors.push('repoName must be a non-empty string');
    } else if (!REPO_IDENT_RE.test((repoName as string).trim())) {
      errors.push('repoName contains invalid characters');
    }
  }

  if (defaultBranch !== undefined && defaultBranch !== null) {
    if (typeof defaultBranch !== 'string' || (defaultBranch as string).trim().length === 0) {
      errors.push('defaultBranch must be a non-empty string');
    }
  }

  return errors;
}

function buildRepoUrl(repoOwner: string | null, repoName: string | null): string | null {
  if (!repoOwner || !repoName) return null;
  return `https://github.com/${repoOwner}/${repoName}`;
}

// ── name validation ────────────────────────────────────────────────────────

describe('validateProject — name', () => {
  test('valid name passes', () => {
    assert.deepEqual(validateProject({ name: 'My Project' }), []);
  });

  test('missing name fails when required', () => {
    const errs = validateProject({});
    assert.ok(errs.some((e) => e.includes('name')));
  });

  test('empty string name fails', () => {
    const errs = validateProject({ name: '' });
    assert.ok(errs.some((e) => e.includes('name')));
  });

  test('whitespace-only name fails', () => {
    const errs = validateProject({ name: '   ' });
    assert.ok(errs.some((e) => e.includes('name')));
  });

  test('name over 200 chars fails', () => {
    const errs = validateProject({ name: 'x'.repeat(201) });
    assert.ok(errs.some((e) => e.includes('200')));
  });

  test('name exactly 200 chars passes', () => {
    assert.deepEqual(validateProject({ name: 'x'.repeat(200) }), []);
  });
});

// ── repoOwner validation ───────────────────────────────────────────────────

describe('validateProject — repoOwner', () => {
  test('valid GitHub org name passes', () => {
    assert.deepEqual(validateProject({ name: 'P', repoOwner: 'glttech' }), []);
  });

  test('owner with hyphen passes', () => {
    assert.deepEqual(validateProject({ name: 'P', repoOwner: 'my-org' }), []);
  });

  test('owner with dot passes', () => {
    assert.deepEqual(validateProject({ name: 'P', repoOwner: 'my.org' }), []);
  });

  test('owner with spaces fails', () => {
    const errs = validateProject({ name: 'P', repoOwner: 'my org' });
    assert.ok(errs.some((e) => e.includes('repoOwner')));
  });

  test('owner with slash fails', () => {
    const errs = validateProject({ name: 'P', repoOwner: 'org/sub' });
    assert.ok(errs.some((e) => e.includes('repoOwner')));
  });

  test('empty repoOwner fails', () => {
    const errs = validateProject({ name: 'P', repoOwner: '' });
    assert.ok(errs.some((e) => e.includes('repoOwner')));
  });

  test('null repoOwner is allowed (optional)', () => {
    assert.deepEqual(validateProject({ name: 'P', repoOwner: null }), []);
  });

  test('undefined repoOwner is allowed (optional)', () => {
    assert.deepEqual(validateProject({ name: 'P' }), []);
  });
});

// ── repoName validation ────────────────────────────────────────────────────

describe('validateProject — repoName', () => {
  test('valid repo name passes', () => {
    assert.deepEqual(validateProject({ name: 'P', repoName: 'Coder-by-devascend' }), []);
  });

  test('repo name with dot passes', () => {
    assert.deepEqual(validateProject({ name: 'P', repoName: 'my.repo' }), []);
  });

  test('repo name with space fails', () => {
    const errs = validateProject({ name: 'P', repoName: 'my repo' });
    assert.ok(errs.some((e) => e.includes('repoName')));
  });

  test('null repoName is allowed (optional)', () => {
    assert.deepEqual(validateProject({ name: 'P', repoName: null }), []);
  });
});

// ── defaultBranch validation ───────────────────────────────────────────────

describe('validateProject — defaultBranch', () => {
  test('valid branch name passes', () => {
    assert.deepEqual(validateProject({ name: 'P', defaultBranch: 'main' }), []);
  });

  test('empty defaultBranch fails', () => {
    const errs = validateProject({ name: 'P', defaultBranch: '' });
    assert.ok(errs.some((e) => e.includes('defaultBranch')));
  });

  test('whitespace defaultBranch fails', () => {
    const errs = validateProject({ name: 'P', defaultBranch: '  ' });
    assert.ok(errs.some((e) => e.includes('defaultBranch')));
  });

  test('null defaultBranch is allowed (optional)', () => {
    assert.deepEqual(validateProject({ name: 'P', defaultBranch: null }), []);
  });
});

// ── buildRepoUrl ───────────────────────────────────────────────────────────

describe('buildRepoUrl', () => {
  test('returns GitHub URL when both owner and name present', () => {
    assert.equal(buildRepoUrl('glttech', 'Coder-by-devascend'), 'https://github.com/glttech/Coder-by-devascend');
  });

  test('returns null when owner is null', () => {
    assert.equal(buildRepoUrl(null, 'my-repo'), null);
  });

  test('returns null when name is null', () => {
    assert.equal(buildRepoUrl('org', null), null);
  });

  test('returns null when both null', () => {
    assert.equal(buildRepoUrl(null, null), null);
  });
});

// ── multiple validation errors ─────────────────────────────────────────────

describe('validateProject — multiple errors', () => {
  test('collects all errors at once', () => {
    const errs = validateProject({ name: '', repoOwner: 'bad name', repoName: 'bad name' });
    assert.ok(errs.length >= 3);
  });
});
