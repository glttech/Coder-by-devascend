import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const VALID_TRIGGERS = ['ci_failure', 'reviewer_block', 'policy_block', 'run_failure', 'manual_rollback'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

function validateIncident(body: Record<string, unknown>): string[] {
  const { title, description, trigger, severity, failedCommand, failedTest } = body;
  const errors: string[] = [];

  if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
    errors.push('title is required');
  } else if ((title as string).length > 500) {
    errors.push('title must be 500 characters or fewer');
  }

  if (description !== undefined && typeof description === 'string' && description.length > 10_000) {
    errors.push('description must be 10,000 characters or fewer');
  }

  if (failedCommand !== undefined && typeof failedCommand === 'string' && failedCommand.length > 5_000) {
    errors.push('failedCommand must be 5,000 characters or fewer');
  }

  if (failedTest !== undefined && typeof failedTest === 'string' && failedTest.length > 5_000) {
    errors.push('failedTest must be 5,000 characters or fewer');
  }

  if (!trigger || !VALID_TRIGGERS.includes(trigger as string)) {
    errors.push(`trigger must be one of: ${VALID_TRIGGERS.join(', ')}`);
  }

  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as string)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  return errors;
}

describe('POST /api/incidents validation', () => {
  test('accepts valid minimal incident', () => {
    const errs = validateIncident({ title: 'Pipeline broke', trigger: 'ci_failure' });
    assert.deepEqual(errs, []);
  });

  test('rejects missing title', () => {
    const errs = validateIncident({ trigger: 'ci_failure' });
    assert.ok(errs.some((e) => e.includes('title is required')));
  });

  test('rejects title over 500 chars', () => {
    const errs = validateIncident({ title: 'x'.repeat(501), trigger: 'ci_failure' });
    assert.ok(errs.some((e) => e.includes('500')));
  });

  test('accepts title at exactly 500 chars', () => {
    const errs = validateIncident({ title: 'x'.repeat(500), trigger: 'ci_failure' });
    assert.deepEqual(errs, []);
  });

  test('rejects description over 10,000 chars', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', description: 'x'.repeat(10_001) });
    assert.ok(errs.some((e) => e.includes('10,000')));
  });

  test('accepts description at exactly 10,000 chars', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', description: 'x'.repeat(10_000) });
    assert.deepEqual(errs, []);
  });

  test('rejects failedCommand over 5,000 chars', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', failedCommand: 'x'.repeat(5_001) });
    assert.ok(errs.some((e) => e.includes('5,000')));
  });

  test('rejects failedTest over 5,000 chars', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', failedTest: 'x'.repeat(5_001) });
    assert.ok(errs.some((e) => e.includes('5,000')));
  });

  test('rejects invalid trigger', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'invalid_trigger' });
    assert.ok(errs.some((e) => e.includes('trigger must be one of')));
  });

  test('rejects invalid severity', () => {
    const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', severity: 'catastrophic' });
    assert.ok(errs.some((e) => e.includes('severity must be one of')));
  });

  test('accepts all valid severities', () => {
    for (const sev of VALID_SEVERITIES) {
      const errs = validateIncident({ title: 'ok', trigger: 'ci_failure', severity: sev });
      assert.deepEqual(errs, [], `severity '${sev}' should be valid`);
    }
  });

  test('accepts all valid triggers', () => {
    for (const trig of VALID_TRIGGERS) {
      const errs = validateIncident({ title: 'ok', trigger: trig });
      assert.deepEqual(errs, [], `trigger '${trig}' should be valid`);
    }
  });
});
