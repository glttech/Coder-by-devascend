import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  riskLevelPriority,
  computeRiskSummary,
  filterPolicyEvents,
  RISK_LEVEL_ORDER,
} from '../policyRules.js';

describe('riskLevelPriority', () => {
  test('critical is highest priority', () => {
    assert.equal(riskLevelPriority('critical'), 4);
  });

  test('ordering: critical > high > medium > low', () => {
    assert.ok(riskLevelPriority('critical') > riskLevelPriority('high'));
    assert.ok(riskLevelPriority('high') > riskLevelPriority('medium'));
    assert.ok(riskLevelPriority('medium') > riskLevelPriority('low'));
    assert.ok(riskLevelPriority('low') > 0);
  });

  test('unknown level returns 0', () => {
    assert.equal(riskLevelPriority('unknown'), 0);
    assert.equal(riskLevelPriority(''), 0);
    assert.equal(riskLevelPriority('catastrophic'), 0);
  });

  test('case-insensitive', () => {
    assert.equal(riskLevelPriority('CRITICAL'), 4);
    assert.equal(riskLevelPriority('High'), 3);
    assert.equal(riskLevelPriority('MEDIUM'), 2);
    assert.equal(riskLevelPriority('LOW'), 1);
  });

  test('RISK_LEVEL_ORDER has exactly 4 levels', () => {
    assert.equal(Object.keys(RISK_LEVEL_ORDER).length, 4);
  });
});

describe('computeRiskSummary', () => {
  test('counts each risk level correctly', () => {
    const tasks = [
      { riskLevel: 'critical' },
      { riskLevel: 'critical' },
      { riskLevel: 'high' },
      { riskLevel: 'medium' },
      { riskLevel: 'low' },
      { riskLevel: 'low' },
    ];
    const summary = computeRiskSummary(tasks);
    assert.equal(summary.critical, 2);
    assert.equal(summary.high, 1);
    assert.equal(summary.medium, 1);
    assert.equal(summary.low, 2);
    assert.equal(summary.unknown, 0);
  });

  test('empty list returns all zeros', () => {
    const summary = computeRiskSummary([]);
    assert.deepEqual(summary, { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 });
  });

  test('unknown risk levels go to unknown bucket', () => {
    const summary = computeRiskSummary([{ riskLevel: 'extreme' }, { riskLevel: '' }]);
    assert.equal(summary.unknown, 2);
    assert.equal(summary.critical + summary.high + summary.medium + summary.low, 0);
  });

  test('case-insensitive risk levels', () => {
    const summary = computeRiskSummary([
      { riskLevel: 'CRITICAL' },
      { riskLevel: 'High' },
      { riskLevel: 'MEDIUM' },
      { riskLevel: 'LOW' },
    ]);
    assert.equal(summary.critical, 1);
    assert.equal(summary.high, 1);
    assert.equal(summary.medium, 1);
    assert.equal(summary.low, 1);
    assert.equal(summary.unknown, 0);
  });

  test('total count equals input length', () => {
    const tasks = [
      { riskLevel: 'high' },
      { riskLevel: 'low' },
      { riskLevel: 'weird' },
    ];
    const s = computeRiskSummary(tasks);
    const total = s.critical + s.high + s.medium + s.low + s.unknown;
    assert.equal(total, tasks.length);
  });
});

describe('filterPolicyEvents', () => {
  test('keeps only policy gate events', () => {
    const events = [
      { event: 'task_created' },
      { event: 'policy_gate_blocked' },
      { event: 'task_approval_decided' },
      { event: 'policy_gate_approved' },
    ];
    const filtered = filterPolicyEvents(events);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((e) => e.event.startsWith('policy_gate_')));
  });

  test('returns empty array when no policy events', () => {
    const filtered = filterPolicyEvents([{ event: 'task_created' }, { event: 'operator_session_created' }]);
    assert.deepEqual(filtered, []);
  });

  test('returns empty array for empty input', () => {
    assert.deepEqual(filterPolicyEvents([]), []);
  });

  test('includes both policy_gate_blocked and policy_gate_approved', () => {
    const events = [{ event: 'policy_gate_blocked' }, { event: 'policy_gate_approved' }];
    const filtered = filterPolicyEvents(events);
    assert.equal(filtered.length, 2);
  });
});
