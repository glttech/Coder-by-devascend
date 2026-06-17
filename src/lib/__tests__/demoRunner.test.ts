/**
 * Tests for the Pilot Demo Workflow (PR 1.3).
 *
 * Uses node:test — NOT Jest. No real DB calls.
 * runOrchestrator calls writeTrace/writeAudit which swallow DB errors by design.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_SCENARIOS, DEMO_TASKS } from '../demo/seed.js';
import { runDemoScenario } from '../demo/runner.js';

// ---------------------------------------------------------------------------
// Seed data shape tests
// ---------------------------------------------------------------------------

describe('DEMO_SCENARIOS seed data', () => {
  it('has exactly 3 scenarios', () => {
    assert.equal(DEMO_SCENARIOS.length, 3);
  });

  it('has exactly 3 tasks', () => {
    assert.equal(DEMO_TASKS.length, 3);
  });

  it('covers all three risk levels', () => {
    const riskLevels = DEMO_SCENARIOS.map((s) => s.task.riskLevel);
    assert.ok(riskLevels.includes('low'), 'Must have a low-risk scenario');
    assert.ok(riskLevels.includes('medium'), 'Must have a medium-risk scenario');
    assert.ok(riskLevels.includes('high'), 'Must have a high-risk scenario');
  });

  it('all scenarios have at least one role', () => {
    for (const scenario of DEMO_SCENARIOS) {
      assert.ok(scenario.roles.length > 0, `Scenario "${scenario.task.title}" must have roles`);
    }
  });

  it('no scenario expectedDecision is APPROVED', () => {
    for (const scenario of DEMO_SCENARIOS) {
      assert.notEqual(scenario.expectedDecision, 'APPROVED');
    }
  });
});

// ---------------------------------------------------------------------------
// runDemoScenario tests
// ---------------------------------------------------------------------------

describe('runDemoScenario', () => {
  it('returns valid DemoRunResult shape for scenario 0 (low risk)', async () => {
    const result = await runDemoScenario(0);

    assert.equal(result.scenario.task.riskLevel, 'low');
    assert.ok(Array.isArray(result.roleOutputs));
    assert.ok(result.roleOutputs.length > 0, 'Must have at least one role output');
    assert.ok(typeof result.finalDecision === 'string');
    assert.ok(typeof result.seniorApprovalRequired === 'boolean');
    assert.ok(typeof result.summary === 'string' && result.summary.length > 0);
  });

  it('scenario 1 (medium risk) returns at least one role output', async () => {
    const result = await runDemoScenario(1);

    assert.equal(result.scenario.task.riskLevel, 'medium');
    assert.ok(result.roleOutputs.length >= 1);
  });

  it('scenario 2 (high risk) has seniorApprovalRequired true', async () => {
    const result = await runDemoScenario(2);

    assert.equal(result.scenario.task.riskLevel, 'high');
    assert.equal(result.seniorApprovalRequired, true, 'High-risk scenario must require senior approval');
  });

  it('finalDecision is never APPROVED for any scenario', async () => {
    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      const result = await runDemoScenario(i);
      assert.notEqual(
        result.finalDecision,
        'APPROVED',
        `Scenario ${i} must never have finalDecision APPROVED`,
      );
    }
  });

  it('all roleOutputs have riskScore between 0 and 1', async () => {
    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      const result = await runDemoScenario(i);
      for (const output of result.roleOutputs) {
        assert.ok(output.riskScore >= 0, `riskScore must be >= 0 for role ${output.roleKey}`);
        assert.ok(output.riskScore <= 1, `riskScore must be <= 1 for role ${output.roleKey}`);
      }
    }
  });

  it('throws for out-of-range scenarioIndex', async () => {
    await assert.rejects(
      () => runDemoScenario(999),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('out of range'));
        return true;
      },
    );
  });

  it('throws for negative scenarioIndex', async () => {
    await assert.rejects(() => runDemoScenario(-1));
  });
});
