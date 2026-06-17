/**
 * Tests for the Agent Role System (PR 1.1).
 *
 * Uses node:test — NOT Jest. No real DB calls.
 * Mocks are done by overriding module behavior through controlled inputs.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// We import as .js because tsx resolves TS paths but node:test uses the compiled output path style
import {
  getRole,
  listRoles,
  assertRoleCanActOn,
  BUILT_IN_ROLES,
} from '../agents/roles.js';

import { runAgentRole } from '../llm/chat.js';

// ---------------------------------------------------------------------------
// Role lookup tests
// ---------------------------------------------------------------------------

describe('getRole', () => {
  it('returns the security_reviewer role with correct maxRiskLevel', () => {
    const role = getRole('security_reviewer');
    assert.ok(role, 'security_reviewer must exist');
    assert.equal(role.key, 'security_reviewer');
    assert.equal(role.maxRiskLevel, 'high');
    assert.equal(role.outputFormat, 'structured_findings');
  });

  it('returns undefined for a non-existent role', () => {
    const role = getRole('nonexistent_role');
    assert.equal(role, undefined);
  });

  it('returns product_analyst with maxRiskLevel low', () => {
    const role = getRole('product_analyst');
    assert.ok(role);
    assert.equal(role.maxRiskLevel, 'low');
  });

  it('returns developer with maxRiskLevel medium', () => {
    const role = getRole('developer');
    assert.ok(role);
    assert.equal(role.maxRiskLevel, 'medium');
  });
});

// ---------------------------------------------------------------------------
// listRoles tests
// ---------------------------------------------------------------------------

describe('listRoles', () => {
  it('returns exactly 7 built-in roles', () => {
    const roles = listRoles();
    assert.equal(roles.length, 7);
  });

  it('includes all expected role keys', () => {
    const roles = listRoles();
    const keys = roles.map((r) => r.key);
    const expectedKeys = [
      'product_analyst',
      'architect',
      'developer',
      'reviewer',
      'security_reviewer',
      'qa',
      'release_manager',
    ];
    for (const key of expectedKeys) {
      assert.ok(keys.includes(key), `Expected role key "${key}" to be present`);
    }
  });

  it('all built-in roles have required fields', () => {
    for (const role of BUILT_IN_ROLES) {
      assert.ok(role.key, `Role must have a key: ${JSON.stringify(role)}`);
      assert.ok(role.name, `Role "${role.key}" must have a name`);
      assert.ok(role.systemPrompt, `Role "${role.key}" must have a systemPrompt`);
      assert.ok(
        ['low', 'medium', 'high'].includes(role.maxRiskLevel),
        `Role "${role.key}" maxRiskLevel must be low|medium|high, got: ${role.maxRiskLevel}`,
      );
      assert.equal(
        role.outputFormat,
        'structured_findings',
        `Role "${role.key}" must have outputFormat "structured_findings"`,
      );
      assert.ok(Array.isArray(role.allowedTools), `Role "${role.key}" allowedTools must be array`);
    }
  });
});

// ---------------------------------------------------------------------------
// assertRoleCanActOn tests
// ---------------------------------------------------------------------------

describe('assertRoleCanActOn', () => {
  it('throws when product_analyst (maxRisk: low) tries to act on a high-risk task', () => {
    const role = getRole('product_analyst');
    assert.ok(role);
    assert.throws(
      () => assertRoleCanActOn(role, 'high'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('not authorized'),
          `Expected "not authorized" in error message, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('throws when product_analyst (maxRisk: low) tries to act on a medium-risk task', () => {
    const role = getRole('product_analyst');
    assert.ok(role);
    assert.throws(() => assertRoleCanActOn(role, 'medium'));
  });

  it('does not throw when product_analyst acts on a low-risk task', () => {
    const role = getRole('product_analyst');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'low'));
  });

  it('does not throw when security_reviewer (maxRisk: high) acts on a high-risk task', () => {
    const role = getRole('security_reviewer');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'high'));
  });

  it('does not throw when security_reviewer acts on a low-risk task', () => {
    const role = getRole('security_reviewer');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'low'));
  });

  it('does not throw when developer (maxRisk: medium) acts on a medium-risk task', () => {
    const role = getRole('developer');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'medium'));
  });

  it('throws when developer (maxRisk: medium) tries to act on a high-risk task', () => {
    const role = getRole('developer');
    assert.ok(role);
    assert.throws(() => assertRoleCanActOn(role, 'high'));
  });

  it('does not throw when reviewer (maxRisk: medium) acts on a low-risk task', () => {
    const role = getRole('reviewer');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'low'));
  });

  it('does not throw when architect (maxRisk: high) acts on any risk level', () => {
    const role = getRole('architect');
    assert.ok(role);
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'low'));
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'medium'));
    assert.doesNotThrow(() => assertRoleCanActOn(role, 'high'));
  });
});

// ---------------------------------------------------------------------------
// runAgentRole stub tests (FEATURE_AGENT_LLM=false by default)
// ---------------------------------------------------------------------------

describe('runAgentRole (stub mode — FEATURE_AGENT_LLM=false)', () => {
  it('returns stub output for security_reviewer (high-risk role) with requiresApproval: true', async () => {
    const role = getRole('security_reviewer');
    assert.ok(role);
    const output = await runAgentRole({
      role,
      taskTitle: 'Test task',
      taskInstruction: 'Review auth changes',
      riskLevel: 'high',
      environment: 'staging',
    });
    assert.equal(output.roleKey, 'security_reviewer');
    assert.equal(output.requiresApproval, true, 'High-risk roles must require approval');
    assert.ok(Array.isArray(output.findings));
    assert.ok(output.findings.length > 0, 'Stub must return at least one finding');
    assert.equal(output.findings[0].category, 'governance');
    assert.equal(output.findings[0].severity, 'info');
  });

  it('returns stub output for product_analyst (low-risk role) with requiresApproval: false', async () => {
    const role = getRole('product_analyst');
    assert.ok(role);
    const output = await runAgentRole({
      role,
      taskTitle: 'Analyze requirements',
      taskInstruction: 'Define user stories for login flow',
      riskLevel: 'low',
      environment: 'dev',
    });
    assert.equal(output.roleKey, 'product_analyst');
    assert.equal(output.requiresApproval, false, 'Low-risk role stub must not require approval');
  });

  it('stub decisionSuggestion is never APPROVED (no such code exists)', async () => {
    for (const role of BUILT_IN_ROLES) {
      const output = await runAgentRole({
        role,
        taskTitle: 'test',
        taskInstruction: 'test instruction',
        riskLevel: 'low',
        environment: 'dev',
      });
      assert.notEqual(
        output.decisionSuggestion,
        'APPROVED',
        `Role "${role.key}" stub must never return APPROVED as decisionSuggestion`,
      );
      // Must be one of the valid codes
      const validCodes = ['CONTINUE', 'RUN_VALIDATION', 'SENIOR_APPROVAL_REQUIRED', 'BLOCKED'];
      assert.ok(
        validCodes.includes(output.decisionSuggestion),
        `Role "${role.key}" decisionSuggestion "${output.decisionSuggestion}" must be a valid code`,
      );
    }
  });

  it('stub output has riskScore between 0 and 1', async () => {
    const role = getRole('developer');
    assert.ok(role);
    const output = await runAgentRole({
      role,
      taskTitle: 'Code review',
      taskInstruction: 'Review the PR',
      riskLevel: 'medium',
      environment: 'dev',
    });
    assert.ok(output.riskScore >= 0, 'riskScore must be >= 0');
    assert.ok(output.riskScore <= 1, 'riskScore must be <= 1');
  });

  it('stub output affectedFiles is an empty array (no file analysis without LLM)', async () => {
    const role = getRole('qa');
    assert.ok(role);
    const output = await runAgentRole({
      role,
      taskTitle: 'Test coverage',
      taskInstruction: 'Check test coverage',
      riskLevel: 'medium',
      environment: 'dev',
    });
    assert.ok(Array.isArray(output.affectedFiles));
    assert.equal(output.affectedFiles.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Orchestrator integration test (no DB — uses mocked role + stub LLM)
// ---------------------------------------------------------------------------

describe('runOrchestrator (stub mode)', () => {
  it('returns a valid OrchestratorResult for security_reviewer on a low-risk task', async () => {
    // We import here to keep the describe block synchronous
    const { runOrchestrator } = await import('../agents/orchestrator.js');

    // We cannot call prisma in tests, but runOrchestrator's writeAudit will
    // try to write to DB. We use a taskId that won't match anything but the
    // catch in writeAudit swallows DB errors — so this is safe for unit testing.
    const result = await runOrchestrator({
      taskId: 'test-task-id-does-not-exist',
      taskTitle: 'Security audit test',
      taskInstruction: 'Review the authentication changes',
      riskLevel: 'low',
      environment: 'dev',
      roleKey: 'security_reviewer',
      agentResponse: 'No issues found in auth flow.',
      userId: 'test-user-id',
    });

    assert.equal(result.roleKey, 'security_reviewer');
    assert.ok(typeof result.decisionCode === 'string', 'decisionCode must be a string');
    assert.ok(typeof result.seniorApprovalRequired === 'boolean');
    assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    assert.ok(typeof result.riskScore === 'number');
    assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
    assert.ok(result.structuredOutput, 'structuredOutput must be present');
    assert.equal(result.structuredOutput.roleKey, 'security_reviewer');

    // Verify decisionCode is a valid code (never APPROVED)
    const validCodes = [
      'CONTINUE',
      'RUN_VALIDATION',
      'ASK_AGENT_FOR_EVIDENCE',
      'SENIOR_APPROVAL_REQUIRED',
      'BLOCKED',
    ];
    assert.ok(
      validCodes.includes(result.decisionCode),
      `decisionCode "${result.decisionCode}" must be a valid governance code`,
    );
    assert.notEqual(result.decisionCode, 'APPROVED');
  });

  it('throws when given an unknown roleKey', async () => {
    const { runOrchestrator } = await import('../agents/orchestrator.js');
    await assert.rejects(
      () =>
        runOrchestrator({
          taskId: 'test-id',
          taskTitle: 'test',
          taskInstruction: 'test',
          riskLevel: 'low',
          environment: 'dev',
          roleKey: 'nonexistent_role',
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Unknown agent role'));
        return true;
      },
    );
  });

  it('throws when role cannot act on the task risk level', async () => {
    const { runOrchestrator } = await import('../agents/orchestrator.js');
    // product_analyst (maxRisk: low) cannot act on high-risk task
    await assert.rejects(
      () =>
        runOrchestrator({
          taskId: 'test-id',
          taskTitle: 'High risk task',
          taskInstruction: 'Do a production DB migration',
          riskLevel: 'high',
          environment: 'production',
          roleKey: 'product_analyst',
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('not authorized'));
        return true;
      },
    );
  });
});
