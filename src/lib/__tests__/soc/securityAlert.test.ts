import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Pure validation logic mirroring the POST /api/soc/alerts route.
// No DB required — tests cover field validation and business rules only.

const VALID_SOURCES = ['wazuh', 'sentry', 'manual'] as const;
const VALID_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
const VALID_STATUSES = ['new', 'triaging', 'escalated', 'closed'] as const;
const VALID_TRIAGE_RECOMMENDATIONS = ['acknowledge', 'escalate', 'close'] as const;

type AlertSource = typeof VALID_SOURCES[number];
type AlertSeverity = typeof VALID_SEVERITIES[number];
type AlertStatus = typeof VALID_STATUSES[number];

function validateCreateAlert(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const { title, source, severity, description, alertedAt } = body;

  if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
    errors.push('title is required');
  } else if ((title as string).length > 500) {
    errors.push('title must be 500 characters or fewer');
  }

  if (!source || !VALID_SOURCES.includes(source as AlertSource)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as AlertSeverity)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (description !== undefined && typeof description === 'string' && description.length > 10_000) {
    errors.push('description must be 10,000 characters or fewer');
  }

  if (alertedAt !== undefined && alertedAt !== null) {
    const parsed = new Date(alertedAt as string);
    if (isNaN(parsed.getTime())) {
      errors.push('alertedAt must be a valid ISO date string');
    }
  }

  return errors;
}

function validatePatchAlert(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const { status, triageRecommendation, incidentId } = body;

  if (status !== undefined && !VALID_STATUSES.includes(status as AlertStatus)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (
    triageRecommendation !== undefined &&
    !VALID_TRIAGE_RECOMMENDATIONS.includes(triageRecommendation as typeof VALID_TRIAGE_RECOMMENDATIONS[number])
  ) {
    errors.push(`triageRecommendation must be one of: ${VALID_TRIAGE_RECOMMENDATIONS.join(', ')}`);
  }

  if (incidentId !== undefined && incidentId !== null && typeof incidentId !== 'string') {
    errors.push('incidentId must be a string or null');
  }

  return errors;
}

// ── Schema constants ──────────────────────────────────────────────────────────

describe('SecurityAlert schema constants', () => {
  test('exactly 3 valid sources', () => {
    assert.equal(VALID_SOURCES.length, 3);
  });

  test('sources include wazuh, sentry, manual', () => {
    assert.ok(VALID_SOURCES.includes('wazuh'));
    assert.ok(VALID_SOURCES.includes('sentry'));
    assert.ok(VALID_SOURCES.includes('manual'));
  });

  test('exactly 5 severity levels', () => {
    assert.equal(VALID_SEVERITIES.length, 5);
  });

  test('severity levels in ascending order', () => {
    assert.deepEqual([...VALID_SEVERITIES], ['info', 'low', 'medium', 'high', 'critical']);
  });

  test('exactly 4 status values', () => {
    assert.equal(VALID_STATUSES.length, 4);
  });

  test('status lifecycle: new → triaging → escalated → closed', () => {
    assert.ok(VALID_STATUSES.includes('new'));
    assert.ok(VALID_STATUSES.includes('triaging'));
    assert.ok(VALID_STATUSES.includes('escalated'));
    assert.ok(VALID_STATUSES.includes('closed'));
  });

  test('exactly 3 triage recommendations', () => {
    assert.equal(VALID_TRIAGE_RECOMMENDATIONS.length, 3);
  });
});

// ── POST validation ───────────────────────────────────────────────────────────

describe('POST /api/soc/alerts validation', () => {
  test('accepts valid minimal alert', () => {
    const errs = validateCreateAlert({ title: 'Suspicious login', source: 'manual' });
    assert.deepEqual(errs, []);
  });

  test('accepts all valid sources', () => {
    for (const source of VALID_SOURCES) {
      const errs = validateCreateAlert({ title: 'Test', source });
      assert.deepEqual(errs, [], `source '${source}' should be valid`);
    }
  });

  test('accepts all valid severities', () => {
    for (const severity of VALID_SEVERITIES) {
      const errs = validateCreateAlert({ title: 'Test', source: 'manual', severity });
      assert.deepEqual(errs, [], `severity '${severity}' should be valid`);
    }
  });

  test('rejects missing title', () => {
    const errs = validateCreateAlert({ source: 'manual' });
    assert.ok(errs.some((e) => e.includes('title is required')));
  });

  test('rejects empty title', () => {
    const errs = validateCreateAlert({ title: '   ', source: 'manual' });
    assert.ok(errs.some((e) => e.includes('title is required')));
  });

  test('rejects title over 500 chars', () => {
    const errs = validateCreateAlert({ title: 'x'.repeat(501), source: 'manual' });
    assert.ok(errs.some((e) => e.includes('500')));
  });

  test('accepts title at exactly 500 chars', () => {
    const errs = validateCreateAlert({ title: 'x'.repeat(500), source: 'manual' });
    assert.deepEqual(errs, []);
  });

  test('rejects missing source', () => {
    const errs = validateCreateAlert({ title: 'Test' });
    assert.ok(errs.some((e) => e.includes('source must be one of')));
  });

  test('rejects invalid source', () => {
    const errs = validateCreateAlert({ title: 'Test', source: 'splunk' });
    assert.ok(errs.some((e) => e.includes('source must be one of')));
  });

  test('rejects invalid severity', () => {
    const errs = validateCreateAlert({ title: 'Test', source: 'manual', severity: 'catastrophic' });
    assert.ok(errs.some((e) => e.includes('severity must be one of')));
  });

  test('rejects description over 10,000 chars', () => {
    const errs = validateCreateAlert({
      title: 'Test',
      source: 'manual',
      description: 'x'.repeat(10_001),
    });
    assert.ok(errs.some((e) => e.includes('10,000')));
  });

  test('accepts description at exactly 10,000 chars', () => {
    const errs = validateCreateAlert({
      title: 'Test',
      source: 'manual',
      description: 'x'.repeat(10_000),
    });
    assert.deepEqual(errs, []);
  });

  test('rejects invalid alertedAt', () => {
    const errs = validateCreateAlert({
      title: 'Test',
      source: 'manual',
      alertedAt: 'not-a-date',
    });
    assert.ok(errs.some((e) => e.includes('alertedAt')));
  });

  test('accepts valid ISO alertedAt', () => {
    const errs = validateCreateAlert({
      title: 'Test',
      source: 'manual',
      alertedAt: '2026-06-20T10:00:00.000Z',
    });
    assert.deepEqual(errs, []);
  });

  test('accepts null alertedAt', () => {
    const errs = validateCreateAlert({ title: 'Test', source: 'manual', alertedAt: null });
    assert.deepEqual(errs, []);
  });

  test('returns multiple errors when multiple fields invalid', () => {
    const errs = validateCreateAlert({ source: 'bad', severity: 'extreme' });
    assert.ok(errs.length >= 2);
    assert.ok(errs.some((e) => e.includes('title')));
    assert.ok(errs.some((e) => e.includes('source')));
  });
});

// ── PATCH validation ──────────────────────────────────────────────────────────

describe('PATCH /api/soc/alerts/[id] validation', () => {
  test('accepts empty patch (no-op)', () => {
    const errs = validatePatchAlert({});
    assert.deepEqual(errs, []);
  });

  test('accepts all valid statuses', () => {
    for (const status of VALID_STATUSES) {
      const errs = validatePatchAlert({ status });
      assert.deepEqual(errs, [], `status '${status}' should be valid`);
    }
  });

  test('rejects invalid status', () => {
    const errs = validatePatchAlert({ status: 'pending' });
    assert.ok(errs.some((e) => e.includes('status must be one of')));
  });

  test('accepts all valid triage recommendations', () => {
    for (const rec of VALID_TRIAGE_RECOMMENDATIONS) {
      const errs = validatePatchAlert({ triageRecommendation: rec });
      assert.deepEqual(errs, [], `recommendation '${rec}' should be valid`);
    }
  });

  test('rejects invalid triage recommendation', () => {
    const errs = validatePatchAlert({ triageRecommendation: 'ignore' });
    assert.ok(errs.some((e) => e.includes('triageRecommendation')));
  });

  test('accepts string incidentId', () => {
    const errs = validatePatchAlert({ incidentId: 'some-uuid' });
    assert.deepEqual(errs, []);
  });

  test('accepts null incidentId (unlink)', () => {
    const errs = validatePatchAlert({ incidentId: null });
    assert.deepEqual(errs, []);
  });

  test('rejects non-string incidentId', () => {
    const errs = validatePatchAlert({ incidentId: 42 });
    assert.ok(errs.some((e) => e.includes('incidentId')));
  });
});

// ── Pagination helpers ────────────────────────────────────────────────────────

describe('alert list pagination', () => {
  function resolveLimit(raw: string | null): number {
    const n = parseInt(raw ?? '50', 10);
    return isNaN(n) || n < 1 ? 50 : Math.min(n, 200);
  }

  test('defaults to 50', () => assert.equal(resolveLimit(null), 50));
  test('respects provided limit', () => assert.equal(resolveLimit('25'), 25));
  test('clamps to max 200', () => assert.equal(resolveLimit('500'), 200));
  test('falls back to 50 for NaN', () => assert.equal(resolveLimit('abc'), 50));
  test('falls back to 50 for zero', () => assert.equal(resolveLimit('0'), 50));
  test('falls back to 50 for negative', () => assert.equal(resolveLimit('-1'), 50));
  test('accepts exactly 200', () => assert.equal(resolveLimit('200'), 200));
  test('accepts exactly 1', () => assert.equal(resolveLimit('1'), 1));
});

// ── Status filter parsing ─────────────────────────────────────────────────────

describe('alert status filter parsing', () => {
  function parseStatusFilter(param: string | null): string[] {
    if (!param) return [];
    return param.split(',').filter((s) => VALID_STATUSES.includes(s as AlertStatus));
  }

  test('returns empty for null', () => assert.deepEqual(parseStatusFilter(null), []));
  test('returns single valid status', () => assert.deepEqual(parseStatusFilter('new'), ['new']));
  test('returns multiple valid statuses', () => {
    assert.deepEqual(parseStatusFilter('new,triaging'), ['new', 'triaging']);
  });
  test('strips invalid values from filter', () => {
    assert.deepEqual(parseStatusFilter('new,invalid,closed'), ['new', 'closed']);
  });
  test('returns empty when all invalid', () => {
    assert.deepEqual(parseStatusFilter('pending,open'), []);
  });
});
