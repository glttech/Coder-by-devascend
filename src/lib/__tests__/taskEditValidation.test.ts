import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mirror the PATCH /api/tasks/[id] validation logic as pure functions.

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_ENVIRONMENTS = ['local', 'dev', 'staging', 'production'];
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

function validateTaskEdit(body: Record<string, unknown>): string[] {
  const { title, instruction, riskLevel, environment, approvalRequired } = body;
  const errors: string[] = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      errors.push('title must be a non-empty string');
    } else if (title.length > 500) {
      errors.push('title must be 500 characters or fewer');
    }
  }

  if (instruction !== undefined) {
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      errors.push('instruction must be a non-empty string');
    } else if (instruction.length > 50_000) {
      errors.push('instruction must be 50,000 characters or fewer');
    }
  }

  if (riskLevel !== undefined && !VALID_RISK_LEVELS.includes(riskLevel as string)) {
    errors.push(`riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`);
  }

  if (environment !== undefined && !VALID_ENVIRONMENTS.includes(environment as string)) {
    errors.push(`environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }

  if (approvalRequired !== undefined && typeof approvalRequired !== 'boolean') {
    errors.push('approvalRequired must be a boolean');
  }

  return errors;
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function buildUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const { title, instruction, riskLevel, environment, approvalRequired } = body;
  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = (title as string).trim();
  if (instruction !== undefined) updateData.instruction = (instruction as string).trim();
  if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
  if (environment !== undefined) updateData.environment = environment;
  if (approvalRequired !== undefined) updateData.approvalRequired = approvalRequired;
  return updateData;
}

function buildAuditDetails(fields: string[]): string {
  return JSON.stringify({ fields, at: new Date().toISOString() });
}

// ── Title validation ───────────────────────────────────────────────────────

describe('validateTaskEdit — title', () => {
  test('valid title passes', () => {
    assert.deepEqual(validateTaskEdit({ title: 'Fix the bug' }), []);
  });

  test('empty string title fails', () => {
    const errors = validateTaskEdit({ title: '' });
    assert.ok(errors.some((e) => e.includes('title')));
  });

  test('whitespace-only title fails', () => {
    const errors = validateTaskEdit({ title: '   ' });
    assert.ok(errors.some((e) => e.includes('title')));
  });

  test('title over 500 chars fails', () => {
    const errors = validateTaskEdit({ title: 'x'.repeat(501) });
    assert.ok(errors.some((e) => e.includes('500')));
  });

  test('title exactly 500 chars passes', () => {
    assert.deepEqual(validateTaskEdit({ title: 'x'.repeat(500) }), []);
  });

  test('non-string title fails', () => {
    const errors = validateTaskEdit({ title: 42 });
    assert.ok(errors.some((e) => e.includes('title')));
  });

  test('undefined title is ignored (optional field)', () => {
    assert.deepEqual(validateTaskEdit({}), []);
  });
});

// ── Instruction validation ─────────────────────────────────────────────────

describe('validateTaskEdit — instruction', () => {
  test('valid instruction passes', () => {
    assert.deepEqual(validateTaskEdit({ instruction: 'Do the thing' }), []);
  });

  test('empty instruction fails', () => {
    const errors = validateTaskEdit({ instruction: '' });
    assert.ok(errors.some((e) => e.includes('instruction')));
  });

  test('instruction over 50,000 chars fails', () => {
    const errors = validateTaskEdit({ instruction: 'x'.repeat(50_001) });
    assert.ok(errors.some((e) => e.includes('50,000')));
  });

  test('instruction exactly 50,000 chars passes', () => {
    assert.deepEqual(validateTaskEdit({ instruction: 'x'.repeat(50_000) }), []);
  });

  test('undefined instruction is ignored', () => {
    assert.deepEqual(validateTaskEdit({}), []);
  });
});

// ── riskLevel validation ───────────────────────────────────────────────────

describe('validateTaskEdit — riskLevel', () => {
  for (const level of ['low', 'medium', 'high']) {
    test(`valid riskLevel "${level}" passes`, () => {
      assert.deepEqual(validateTaskEdit({ riskLevel: level }), []);
    });
  }

  test('invalid riskLevel fails', () => {
    const errors = validateTaskEdit({ riskLevel: 'critical' });
    assert.ok(errors.some((e) => e.includes('riskLevel')));
  });

  test('undefined riskLevel is ignored', () => {
    assert.deepEqual(validateTaskEdit({}), []);
  });
});

// ── environment validation ─────────────────────────────────────────────────

describe('validateTaskEdit — environment', () => {
  for (const env of ['local', 'dev', 'staging', 'production']) {
    test(`valid environment "${env}" passes`, () => {
      assert.deepEqual(validateTaskEdit({ environment: env }), []);
    });
  }

  test('invalid environment fails', () => {
    const errors = validateTaskEdit({ environment: 'cloud' });
    assert.ok(errors.some((e) => e.includes('environment')));
  });
});

// ── approvalRequired validation ────────────────────────────────────────────

describe('validateTaskEdit — approvalRequired', () => {
  test('boolean true passes', () => {
    assert.deepEqual(validateTaskEdit({ approvalRequired: true }), []);
  });

  test('boolean false passes', () => {
    assert.deepEqual(validateTaskEdit({ approvalRequired: false }), []);
  });

  test('string "true" fails', () => {
    const errors = validateTaskEdit({ approvalRequired: 'true' });
    assert.ok(errors.some((e) => e.includes('approvalRequired')));
  });

  test('number 1 fails', () => {
    const errors = validateTaskEdit({ approvalRequired: 1 });
    assert.ok(errors.some((e) => e.includes('approvalRequired')));
  });
});

// ── Multiple errors collected ──────────────────────────────────────────────

describe('validateTaskEdit — multiple field errors', () => {
  test('returns all errors when multiple fields are invalid', () => {
    const errors = validateTaskEdit({ title: '', riskLevel: 'extreme', approvalRequired: 'yes' });
    assert.ok(errors.length >= 3);
  });
});

// ── Terminal status guard ──────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  test('completed is terminal', () => {
    assert.equal(isTerminalStatus('completed'), true);
  });

  test('failed is terminal', () => {
    assert.equal(isTerminalStatus('failed'), true);
  });

  test('pending is not terminal', () => {
    assert.equal(isTerminalStatus('pending'), false);
  });

  test('running is not terminal', () => {
    assert.equal(isTerminalStatus('running'), false);
  });
});

// ── buildUpdateData — selective field inclusion ───────────────────────────

describe('buildUpdateData', () => {
  test('only includes present fields', () => {
    const data = buildUpdateData({ title: ' trimmed ' });
    assert.ok('title' in data);
    assert.ok(!('instruction' in data));
    assert.ok(!('riskLevel' in data));
  });

  test('trims title whitespace', () => {
    const data = buildUpdateData({ title: '  hello  ' });
    assert.equal(data.title, 'hello');
  });

  test('trims instruction whitespace', () => {
    const data = buildUpdateData({ instruction: '  do it  ' });
    assert.equal(data.instruction, 'do it');
  });

  test('empty body produces no update fields', () => {
    const data = buildUpdateData({});
    assert.equal(Object.keys(data).length, 0);
  });

  test('all fields included when all provided', () => {
    const data = buildUpdateData({
      title: 'T',
      instruction: 'I',
      riskLevel: 'high',
      environment: 'staging',
      approvalRequired: true,
    });
    assert.equal(Object.keys(data).length, 5);
  });
});

// ── Audit details shape ────────────────────────────────────────────────────

describe('task_edited audit details', () => {
  test('returns valid JSON', () => {
    const raw = buildAuditDetails(['title', 'riskLevel']);
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  test('includes fields array and at timestamp', () => {
    const data = JSON.parse(buildAuditDetails(['title']));
    assert.deepEqual(data.fields, ['title']);
    assert.ok(typeof data.at === 'string');
  });

  test('fields array reflects exactly what changed', () => {
    const changed = ['title', 'instruction', 'environment'];
    const data = JSON.parse(buildAuditDetails(changed));
    assert.deepEqual(data.fields, changed);
  });
});
