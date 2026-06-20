import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRawPayload, sanitizeRawPayload, redactSensitiveKeys, RAW_PAYLOAD_MAX_BYTES } from '../../soc/rawPayload.js';

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

// ── Compound cursor ───────────────────────────────────────────────────────────

describe('compound cursor parsing', () => {
  function parseCursor(param: string | null): { date: Date; id: string } | null {
    if (!param) return null;
    const pipeIdx = param.lastIndexOf('|');
    if (pipeIdx <= 0) return null;
    const date = new Date(param.slice(0, pipeIdx));
    const id = param.slice(pipeIdx + 1);
    if (isNaN(date.getTime()) || !id) return null;
    return { date, id };
  }

  function buildCursor(createdAt: Date, id: string): string {
    return `${createdAt.toISOString()}|${id}`;
  }

  test('returns null for null input', () => assert.equal(parseCursor(null), null));
  test('returns null for missing pipe', () => assert.equal(parseCursor('2026-01-01T00:00:00.000Z'), null));
  test('returns null for invalid date', () => assert.equal(parseCursor('not-a-date|some-id'), null));
  test('returns null for empty id', () => assert.equal(parseCursor('2026-01-01T00:00:00.000Z|'), null));
  test('parses valid compound cursor', () => {
    const result = parseCursor('2026-06-20T10:00:00.000Z|abc-123');
    assert.ok(result !== null);
    assert.equal(result.id, 'abc-123');
    assert.equal(result.date.toISOString(), '2026-06-20T10:00:00.000Z');
  });
  test('roundtrips through buildCursor', () => {
    const date = new Date('2026-06-20T10:00:00.000Z');
    const id = 'test-uuid-456';
    const cursor = buildCursor(date, id);
    const parsed = parseCursor(cursor);
    assert.ok(parsed !== null);
    assert.equal(parsed.id, id);
    assert.equal(parsed.date.toISOString(), date.toISOString());
  });
  test('returns null when cursor has extra pipe (date portion becomes invalid)', () => {
    // UUIDs never contain pipes; if they did, date portion would be unparseable → null
    const cursor = '2026-06-20T10:00:00.000Z|id-with|pipe';
    const parsed = parseCursor(cursor);
    assert.equal(parsed, null);
  });
});

// ── Raw payload safety ────────────────────────────────────────────────────────

describe('raw payload validation', () => {
  test('accepts undefined payload', () => {
    assert.deepEqual(validateRawPayload(undefined), []);
  });
  test('accepts null payload', () => {
    assert.deepEqual(validateRawPayload(null), []);
  });
  test('accepts valid small object', () => {
    assert.deepEqual(validateRawPayload({ event: 'login', ip: '1.2.3.4' }), []);
  });
  test('rejects array payload', () => {
    const errs = validateRawPayload([{ a: 1 }]);
    assert.ok(errs.some((e) => e.includes('JSON object')));
  });
  test('rejects string payload', () => {
    const errs = validateRawPayload('{"key":"val"}');
    assert.ok(errs.some((e) => e.includes('JSON object')));
  });
  test('rejects oversized payload', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) big[`key${i}`] = 'x'.repeat(110);
    const errs = validateRawPayload(big);
    assert.ok(errs.some((e) => e.includes(RAW_PAYLOAD_MAX_BYTES.toLocaleString())));
  });
  test('accepts payload at boundary (just under limit)', () => {
    // Build a payload that serializes to just under RAW_PAYLOAD_MAX_BYTES
    const val = 'x'.repeat(RAW_PAYLOAD_MAX_BYTES - 15);
    const errs = validateRawPayload({ v: val });
    assert.deepEqual(errs, []);
  });
});

describe('raw payload sensitive key redaction', () => {
  test('redacts password key', () => {
    const result = redactSensitiveKeys({ password: 'secret123', user: 'alice' });
    assert.deepEqual(result, { password: '[REDACTED]', user: 'alice' });
  });
  test('redacts token key (case-insensitive)', () => {
    const result = redactSensitiveKeys({ Token: 'abc', name: 'test' });
    assert.deepEqual(result, { Token: '[REDACTED]', name: 'test' });
  });
  test('redacts api_key variant', () => {
    const result = redactSensitiveKeys({ api_key: 'sk-xyz', source: 'wazuh' });
    assert.deepEqual(result, { api_key: '[REDACTED]', source: 'wazuh' });
  });
  test('redacts nested sensitive keys', () => {
    const result = redactSensitiveKeys({ meta: { secret: 'abc', label: 'ok' } });
    assert.deepEqual(result, { meta: { secret: '[REDACTED]', label: 'ok' } });
  });
  test('does not redact non-sensitive keys', () => {
    const input = { event: 'login', severity: 'high', ip: '10.0.0.1' };
    assert.deepEqual(redactSensitiveKeys(input), input);
  });
  test('handles arrays inside payload', () => {
    const result = redactSensitiveKeys({ items: [{ password: 'x' }, { label: 'y' }] });
    assert.deepEqual(result, { items: [{ password: '[REDACTED]' }, { label: 'y' }] });
  });
  test('sanitizeRawPayload returns null for null', () => {
    assert.equal(sanitizeRawPayload(null), null);
  });
  test('sanitizeRawPayload returns null for undefined', () => {
    assert.equal(sanitizeRawPayload(undefined), null);
  });
});

// ── Org scope enforcement ─────────────────────────────────────────────────────

describe('org scope enforcement', () => {
  // Mirrors the access check in GET and PATCH /api/soc/alerts/[id]
  function canAccessAlert(alertOrgId: string, userOrgId: string): boolean {
    return alertOrgId === userOrgId;
  }

  test('allows access when orgIds match', () => {
    assert.ok(canAccessAlert('org_abc', 'org_abc'));
  });
  test('denies access when orgIds differ', () => {
    assert.ok(!canAccessAlert('org_abc', 'org_xyz'));
  });
  test('denies access for default org vs custom org', () => {
    assert.ok(!canAccessAlert('org_default', 'org_custom'));
  });
  test('allows access when both are org_default', () => {
    assert.ok(canAccessAlert('org_default', 'org_default'));
  });
  test('is case-sensitive', () => {
    assert.ok(!canAccessAlert('Org_ABC', 'org_abc'));
  });

  // Mirrors archivedAt filter logic
  function isActiveAlert(archivedAt: Date | null): boolean {
    return archivedAt === null;
  }

  test('active alert has null archivedAt', () => {
    assert.ok(isActiveAlert(null));
  });
  test('archived alert has non-null archivedAt', () => {
    assert.ok(!isActiveAlert(new Date()));
  });
});
