import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessPostmortemContent,
  computeStatusSummary,
  instructionStatusPriority,
  sortByStatusPriority,
  severityColor,
  isSeverityHigh,
} from '../changeControlHelpers.js';

// ---------------------------------------------------------------------------
// Postmortem content assessment
// ---------------------------------------------------------------------------

describe('assessPostmortemContent', () => {
  test('returns all false for empty incident', () => {
    const result = assessPostmortemContent({});
    assert.equal(result.hasSummary, false);
    assert.equal(result.hasTimeline, false);
    assert.equal(result.hasRootCause, false);
    assert.equal(result.hasImpact, false);
    assert.equal(result.hasActionItems, false);
    assert.equal(result.isComplete, false);
  });

  test('detects summary when description is present', () => {
    const result = assessPostmortemContent({ description: 'System went down due to OOM.' });
    assert.equal(result.hasSummary, true);
  });

  test('treats whitespace-only description as no summary', () => {
    const result = assessPostmortemContent({ description: '   ' });
    assert.equal(result.hasSummary, false);
  });

  test('detects timeline when JSON array has entries', () => {
    const timeline = JSON.stringify([{ timestamp: '2024-01-01T00:00:00Z', event: 'Alarm fired' }]);
    const result = assessPostmortemContent({ timeline });
    assert.equal(result.hasTimeline, true);
  });

  test('treats empty JSON array as no timeline', () => {
    const result = assessPostmortemContent({ timeline: '[]' });
    assert.equal(result.hasTimeline, false);
  });

  test('treats invalid JSON timeline as no timeline', () => {
    const result = assessPostmortemContent({ timeline: 'not-json' });
    assert.equal(result.hasTimeline, false);
  });

  test('marks isComplete only when all five sections have content', () => {
    const timeline = JSON.stringify([{ timestamp: '2024-01-01T00:00:00Z', event: 'Alert' }]);
    const result = assessPostmortemContent({
      description: 'What happened',
      timeline,
      riskCategory: 'ci_failure',
      reviewerDecision: 'High impact on prod',
      followUpAction: 'Add circuit breaker',
    });
    assert.equal(result.isComplete, true);
  });

  test('not complete when only some sections filled', () => {
    const result = assessPostmortemContent({
      description: 'Something happened',
      riskCategory: 'manual_rollback',
    });
    assert.equal(result.isComplete, false);
  });
});

// ---------------------------------------------------------------------------
// Status summary computation
// ---------------------------------------------------------------------------

describe('computeStatusSummary', () => {
  test('counts correctly for mixed statuses', () => {
    const statuses = [
      'pending_approval',
      'pending_approval',
      'approved',
      'blocked',
      'draft',
      'executing',
      'completed',
    ];
    const summary = computeStatusSummary(statuses);
    assert.equal(summary.total, 7);
    assert.equal(summary.pending_approval, 2);
    assert.equal(summary.approved, 1);
    assert.equal(summary.blocked, 1);
    assert.equal(summary.draft, 1);
    assert.equal(summary.executing, 1);
    assert.equal(summary.completed, 1);
  });

  test('returns all zeros for empty array', () => {
    const summary = computeStatusSummary([]);
    assert.equal(summary.total, 0);
    assert.equal(summary.pending_approval, 0);
    assert.equal(summary.approved, 0);
  });

  test('ignores unknown status values (does not throw)', () => {
    const summary = computeStatusSummary(['unknown_status', 'approved']);
    assert.equal(summary.total, 2);
    assert.equal(summary.approved, 1);
  });
});

// ---------------------------------------------------------------------------
// Instruction status priority ordering
// ---------------------------------------------------------------------------

describe('instructionStatusPriority', () => {
  test('blocked has lower index than pending_approval', () => {
    assert.ok(instructionStatusPriority('blocked') < instructionStatusPriority('pending_approval'));
  });

  test('pending_approval has lower index than executing', () => {
    assert.ok(
      instructionStatusPriority('pending_approval') < instructionStatusPriority('executing')
    );
  });

  test('completed has the lowest urgency among known statuses', () => {
    const known = ['blocked', 'pending_approval', 'executing', 'approved', 'draft', 'completed'];
    const maxPriority = Math.max(...known.map(instructionStatusPriority));
    assert.equal(instructionStatusPriority('completed'), maxPriority);
  });

  test('unknown status returns high numeric value (low urgency)', () => {
    assert.ok(instructionStatusPriority('foobar') > instructionStatusPriority('completed'));
  });
});

// ---------------------------------------------------------------------------
// Sort by status priority
// ---------------------------------------------------------------------------

describe('sortByStatusPriority', () => {
  test('blocked instructions sort before pending', () => {
    const items = [
      { status: 'pending_approval', createdAt: new Date('2024-01-01') },
      { status: 'blocked',          createdAt: new Date('2024-01-02') },
    ];
    const sorted = sortByStatusPriority(items);
    assert.equal(sorted[0].status, 'blocked');
  });

  test('does not mutate original array', () => {
    const items = [
      { status: 'completed',  createdAt: new Date('2024-01-01') },
      { status: 'blocked',    createdAt: new Date('2024-01-02') },
    ];
    sortByStatusPriority(items);
    assert.equal(items[0].status, 'completed'); // original unchanged
  });
});

// ---------------------------------------------------------------------------
// Severity badge mapping
// ---------------------------------------------------------------------------

describe('severityColor', () => {
  test('critical returns red hex', () => {
    const color = severityColor('critical');
    assert.equal(color, '#ef4444');
  });

  test('high returns orange hex', () => {
    const color = severityColor('high');
    assert.equal(color, '#f97316');
  });

  test('medium returns amber hex', () => {
    const color = severityColor('medium');
    assert.equal(color, '#f59e0b');
  });

  test('low returns green hex', () => {
    const color = severityColor('low');
    assert.equal(color, '#22c55e');
  });

  test('unknown severity returns fallback gray color', () => {
    const color = severityColor('unknown_level');
    assert.equal(color, '#6b7280');
  });
});

describe('isSeverityHigh', () => {
  test('returns true for "high"', () => {
    assert.equal(isSeverityHigh('high'), true);
  });

  test('returns true for "critical"', () => {
    assert.equal(isSeverityHigh('critical'), true);
  });

  test('returns false for "medium"', () => {
    assert.equal(isSeverityHigh('medium'), false);
  });

  test('returns false for "low"', () => {
    assert.equal(isSeverityHigh('low'), false);
  });

  test('returns false for unknown value', () => {
    assert.equal(isSeverityHigh('unknown'), false);
  });
});
