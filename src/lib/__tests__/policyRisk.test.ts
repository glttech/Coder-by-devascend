import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  riskLevelPriority,
  computeRiskSummary,
  filterPolicyEvents,
  RISK_LEVEL_ORDER,
} from '../policyRules.js';

// ---------------------------------------------------------------------------
// Risk level priority ordering
// ---------------------------------------------------------------------------

describe('riskLevelPriority — ordering', () => {
  it('CRITICAL has the highest priority', () => {
    const critical = riskLevelPriority('critical');
    assert.ok(critical > riskLevelPriority('high'), 'critical > high');
    assert.ok(critical > riskLevelPriority('medium'), 'critical > medium');
    assert.ok(critical > riskLevelPriority('low'), 'critical > low');
  });

  it('HIGH is strictly between CRITICAL and MEDIUM', () => {
    assert.ok(
      riskLevelPriority('high') > riskLevelPriority('medium'),
      'high > medium',
    );
    assert.ok(
      riskLevelPriority('high') < riskLevelPriority('critical'),
      'high < critical',
    );
  });

  it('MEDIUM is strictly between HIGH and LOW', () => {
    assert.ok(
      riskLevelPriority('medium') > riskLevelPriority('low'),
      'medium > low',
    );
    assert.ok(
      riskLevelPriority('medium') < riskLevelPriority('high'),
      'medium < high',
    );
  });

  it('LOW has the lowest priority among known levels', () => {
    assert.equal(riskLevelPriority('low'), RISK_LEVEL_ORDER['low']);
    assert.ok(riskLevelPriority('low') < riskLevelPriority('medium'));
  });

  it('unknown level returns 0', () => {
    assert.equal(riskLevelPriority('unknown'), 0);
    assert.equal(riskLevelPriority(''), 0);
  });

  it('priority values form a strict ascending sequence low < medium < high < critical', () => {
    const levels = ['low', 'medium', 'high', 'critical'];
    const priorities = levels.map(riskLevelPriority);
    for (let i = 1; i < priorities.length; i++) {
      assert.ok(
        priorities[i] > priorities[i - 1],
        `${levels[i]} (${priorities[i]}) must be > ${levels[i - 1]} (${priorities[i - 1]})`,
      );
    }
  });

  it('is case-insensitive for standard levels', () => {
    assert.equal(riskLevelPriority('CRITICAL'), riskLevelPriority('critical'));
    assert.equal(riskLevelPriority('HIGH'), riskLevelPriority('high'));
    assert.equal(riskLevelPriority('MEDIUM'), riskLevelPriority('medium'));
    assert.equal(riskLevelPriority('LOW'), riskLevelPriority('low'));
  });
});

// ---------------------------------------------------------------------------
// Risk summary computation
// ---------------------------------------------------------------------------

describe('computeRiskSummary', () => {
  it('returns all zeros for an empty task list', () => {
    const summary = computeRiskSummary([]);
    assert.equal(summary.critical, 0);
    assert.equal(summary.high, 0);
    assert.equal(summary.medium, 0);
    assert.equal(summary.low, 0);
    assert.equal(summary.unknown, 0);
  });

  it('counts tasks by risk level correctly', () => {
    const tasks = [
      { riskLevel: 'critical' },
      { riskLevel: 'critical' },
      { riskLevel: 'high' },
      { riskLevel: 'medium' },
      { riskLevel: 'medium' },
      { riskLevel: 'medium' },
      { riskLevel: 'low' },
    ];
    const summary = computeRiskSummary(tasks);
    assert.equal(summary.critical, 2);
    assert.equal(summary.high, 1);
    assert.equal(summary.medium, 3);
    assert.equal(summary.low, 1);
    assert.equal(summary.unknown, 0);
  });

  it('handles case-insensitive risk levels', () => {
    const tasks = [
      { riskLevel: 'CRITICAL' },
      { riskLevel: 'High' },
      { riskLevel: 'MEDIUM' },
      { riskLevel: 'Low' },
    ];
    const summary = computeRiskSummary(tasks);
    assert.equal(summary.critical, 1);
    assert.equal(summary.high, 1);
    assert.equal(summary.medium, 1);
    assert.equal(summary.low, 1);
  });

  it('counts unknown/missing risk levels in unknown bucket', () => {
    const tasks = [
      { riskLevel: 'none' },
      { riskLevel: '' },
      { riskLevel: 'unknown' },
    ];
    const summary = computeRiskSummary(tasks);
    assert.equal(summary.unknown, 3);
    assert.equal(summary.critical + summary.high + summary.medium + summary.low, 0);
  });

  it('total count equals sum of all buckets', () => {
    const tasks = [
      { riskLevel: 'critical' },
      { riskLevel: 'high' },
      { riskLevel: 'low' },
      { riskLevel: 'medium' },
      { riskLevel: 'critical' },
    ];
    const summary = computeRiskSummary(tasks);
    const total = summary.critical + summary.high + summary.medium + summary.low + summary.unknown;
    assert.equal(total, tasks.length);
  });
});

// ---------------------------------------------------------------------------
// Policy event filtering
// ---------------------------------------------------------------------------

describe('filterPolicyEvents', () => {
  it('returns empty array for no events', () => {
    assert.deepEqual(filterPolicyEvents([]), []);
  });

  it('keeps only policy_gate_blocked and policy_gate_approved events', () => {
    const events = [
      { event: 'policy_gate_blocked' },
      { event: 'task_created' },
      { event: 'policy_gate_approved' },
      { event: 'agent_run_started' },
      { event: 'task_completed' },
    ];
    const filtered = filterPolicyEvents(events);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((e) => e.event === 'policy_gate_blocked' || e.event === 'policy_gate_approved'));
  });

  it('returns all events when all are policy gate events', () => {
    const events = [
      { event: 'policy_gate_blocked' },
      { event: 'policy_gate_approved' },
      { event: 'policy_gate_blocked' },
    ];
    const filtered = filterPolicyEvents(events);
    assert.equal(filtered.length, 3);
  });

  it('returns empty array when no events match policy gate types', () => {
    const events = [
      { event: 'task_created' },
      { event: 'agent_run_started' },
      { event: 'approval_requested' },
    ];
    const filtered = filterPolicyEvents(events);
    assert.equal(filtered.length, 0);
  });

  it('preserves the original event objects (not copies)', () => {
    const evt = { event: 'policy_gate_blocked', extra: 'data' } as { event: string; extra?: string };
    const filtered = filterPolicyEvents([evt]);
    assert.equal(filtered[0], evt);
  });
});
