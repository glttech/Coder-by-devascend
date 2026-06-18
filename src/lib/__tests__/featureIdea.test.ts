import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Validation helpers (mirrored from the API routes) ─────────────────────────

const VALID_DECISIONS = new Set(['build', 'skip', 'defer', 'under_review']);
const VALID_RELEVANCE = new Set(['low', 'medium', 'high', 'critical']);
const VALID_RISK = new Set(['low', 'medium', 'high']);

function validateFeatureIdeaCreate(body: Record<string, unknown>) {
  if (!body.title || typeof body.title !== 'string' || !String(body.title).trim()) {
    return { ok: false, error: 'title is required', status: 422 };
  }
  if (body.relevance && !VALID_RELEVANCE.has(body.relevance as string)) {
    return { ok: false, error: 'relevance must be one of: low, medium, high, critical', status: 422 };
  }
  if (body.riskLevel && !VALID_RISK.has(body.riskLevel as string)) {
    return { ok: false, error: 'riskLevel must be one of: low, medium, high', status: 422 };
  }
  return { ok: true };
}

function validateFeatureIdeaPatch(body: Record<string, unknown>) {
  if ('relevance' in body && !VALID_RELEVANCE.has(body.relevance as string)) {
    return { ok: false, error: 'Invalid relevance', status: 422 };
  }
  if ('riskLevel' in body && !VALID_RISK.has(body.riskLevel as string)) {
    return { ok: false, error: 'Invalid riskLevel', status: 422 };
  }
  if ('decision' in body && !VALID_DECISIONS.has(body.decision as string)) {
    return { ok: false, error: 'Invalid decision', status: 422 };
  }
  const editableFields = [
    'title', 'description', 'problemSolved', 'vendor', 'sourceUrl',
    'relevance', 'riskLevel', 'decision', 'decisionNote', 'taskId',
    'milestoneId', 'coderHasFeature', 'coderNotes',
  ];
  const hasField = editableFields.some((f) => f in body);
  if (!hasField) {
    return { ok: false, error: 'No valid fields to update', status: 422 };
  }
  return { ok: true };
}

// ── validateFeatureIdeaCreate ──────────────────────────────────────────────────

describe('validateFeatureIdeaCreate', () => {
  test('accepts a minimal valid body', () => {
    const r = validateFeatureIdeaCreate({ title: 'Inline diff view' });
    assert.equal(r.ok, true);
  });

  test('rejects missing title', () => {
    const r = validateFeatureIdeaCreate({});
    assert.equal(r.ok, false);
    assert.match(r.error!, /title/);
    assert.equal(r.status, 422);
  });

  test('rejects empty-string title', () => {
    const r = validateFeatureIdeaCreate({ title: '   ' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /title/);
  });

  test('rejects non-string title', () => {
    const r = validateFeatureIdeaCreate({ title: 42 });
    assert.equal(r.ok, false);
  });

  test('accepts all valid relevance values', () => {
    for (const v of ['low', 'medium', 'high', 'critical']) {
      const r = validateFeatureIdeaCreate({ title: 'T', relevance: v });
      assert.equal(r.ok, true, `expected ok for relevance=${v}`);
    }
  });

  test('rejects invalid relevance', () => {
    const r = validateFeatureIdeaCreate({ title: 'T', relevance: 'extreme' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /relevance/);
    assert.equal(r.status, 422);
  });

  test('accepts all valid riskLevel values', () => {
    for (const v of ['low', 'medium', 'high']) {
      const r = validateFeatureIdeaCreate({ title: 'T', riskLevel: v });
      assert.equal(r.ok, true, `expected ok for riskLevel=${v}`);
    }
  });

  test('rejects invalid riskLevel', () => {
    const r = validateFeatureIdeaCreate({ title: 'T', riskLevel: 'critical' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /riskLevel/);
    assert.equal(r.status, 422);
  });

  test('accepts full body with all optional fields', () => {
    const r = validateFeatureIdeaCreate({
      title: 'Inline diff view',
      description: 'Shows diff inline',
      problemSolved: 'Context switching',
      vendor: 'GitHub Copilot',
      sourceUrl: 'https://example.com',
      relevance: 'high',
      riskLevel: 'low',
      coderHasFeature: false,
      coderNotes: 'Not yet implemented',
    });
    assert.equal(r.ok, true);
  });
});

// ── validateFeatureIdeaPatch ───────────────────────────────────────────────────

describe('validateFeatureIdeaPatch', () => {
  test('rejects empty body (no known fields)', () => {
    const r = validateFeatureIdeaPatch({ foo: 'bar' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /No valid fields/);
    assert.equal(r.status, 422);
  });

  test('accepts decision=build', () => {
    const r = validateFeatureIdeaPatch({ decision: 'build' });
    assert.equal(r.ok, true);
  });

  test('accepts decision=skip', () => {
    const r = validateFeatureIdeaPatch({ decision: 'skip' });
    assert.equal(r.ok, true);
  });

  test('accepts decision=defer', () => {
    const r = validateFeatureIdeaPatch({ decision: 'defer' });
    assert.equal(r.ok, true);
  });

  test('accepts decision=under_review', () => {
    const r = validateFeatureIdeaPatch({ decision: 'under_review' });
    assert.equal(r.ok, true);
  });

  test('rejects invalid decision', () => {
    const r = validateFeatureIdeaPatch({ decision: 'maybe' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /decision/i);
  });

  test('rejects invalid relevance in patch', () => {
    const r = validateFeatureIdeaPatch({ relevance: 'extreme' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /relevance/i);
  });

  test('rejects invalid riskLevel in patch', () => {
    const r = validateFeatureIdeaPatch({ riskLevel: 'critical' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /riskLevel/i);
  });

  test('accepts coderHasFeature update', () => {
    const r = validateFeatureIdeaPatch({ coderHasFeature: true });
    assert.equal(r.ok, true);
  });

  test('accepts decisionNote update', () => {
    const r = validateFeatureIdeaPatch({ decisionNote: 'Too risky for now' });
    assert.equal(r.ok, true);
  });

  test('accepts milestoneId and taskId together', () => {
    const r = validateFeatureIdeaPatch({ milestoneId: 'm1', taskId: 't1' });
    assert.equal(r.ok, true);
  });

  test('accepts null values for optional fields', () => {
    const r = validateFeatureIdeaPatch({ description: null, vendor: null });
    assert.equal(r.ok, true);
  });
});

// ── Decision set completeness ──────────────────────────────────────────────────

describe('VALID_DECISIONS', () => {
  test('contains exactly 4 decisions', () => {
    assert.equal(VALID_DECISIONS.size, 4);
  });

  test('under_review is the default decision', () => {
    assert.ok(VALID_DECISIONS.has('under_review'));
  });

  test('does not include unknown values', () => {
    for (const v of ['pending', 'approved', 'rejected', 'maybe', '']) {
      assert.equal(VALID_DECISIONS.has(v), false, `expected ${v} to be invalid`);
    }
  });
});

// ── Relevance + risk set completeness ─────────────────────────────────────────

describe('VALID_RELEVANCE', () => {
  test('contains exactly 4 levels', () => {
    assert.equal(VALID_RELEVANCE.size, 4);
  });

  test('critical is the highest level', () => {
    assert.ok(VALID_RELEVANCE.has('critical'));
  });
});

describe('VALID_RISK', () => {
  test('contains exactly 3 levels', () => {
    assert.equal(VALID_RISK.size, 3);
  });

  test('does not include critical (only for relevance)', () => {
    assert.equal(VALID_RISK.has('critical'), false);
  });
});
