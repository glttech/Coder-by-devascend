/**
 * Tests for the LLM chat wrapper (src/lib/llm/chat.ts).
 *
 * Uses node:test — NOT Jest. No real API calls — the Anthropic SDK import
 * path is never reached in stub mode, and in LLM-enabled mode we patch
 * process.env and the module's dynamic import does not fire in tests.
 *
 * All tests cover the exported pure functions (buildStubOutput,
 * parseStructuredOutput) plus the featureFlag branch of runAgentRole
 * without requiring ANTHROPIC_API_KEY.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildStubOutput, parseStructuredOutput, runAgentRole } from '../llm/chat.js';
import type { AgentRunInput } from '../llm/chat.js';
import type { RoleDefinition } from '../agents/roles.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LOW_RISK_ROLE: RoleDefinition = {
  key: 'product_analyst',
  name: 'Product Analyst',
  description: 'Test role',
  purpose: 'Test purpose',
  systemPrompt: 'You are a product analyst.',
  allowedTools: [],
  maxRiskLevel: 'low',
  outputFormat: 'structured_findings',
  modelPref: 'claude-haiku-4-5',
  outputSchema: { type: 'StructuredAgentOutput', description: 'test' },
};

const HIGH_RISK_ROLE: RoleDefinition = {
  ...LOW_RISK_ROLE,
  key: 'release_manager',
  name: 'Release Manager',
  maxRiskLevel: 'high',
};

const LOW_RISK_INPUT: AgentRunInput = {
  role: LOW_RISK_ROLE,
  taskTitle: 'Add login page',
  taskInstruction: 'Create a login page with email/password.',
  riskLevel: 'low',
  environment: 'dev',
};

const HIGH_RISK_INPUT: AgentRunInput = {
  ...LOW_RISK_INPUT,
  role: HIGH_RISK_ROLE,
  riskLevel: 'high',
  environment: 'production',
};

// ---------------------------------------------------------------------------
// buildStubOutput
// ---------------------------------------------------------------------------

describe('buildStubOutput', () => {
  it('returns a valid StructuredAgentOutput shape', () => {
    const result = buildStubOutput(LOW_RISK_INPUT);
    assert.equal(result.roleKey, 'product_analyst');
    assert.ok(Array.isArray(result.findings));
    assert.ok(result.findings.length > 0);
    assert.ok(Array.isArray(result.affectedFiles));
    assert.equal(typeof result.riskScore, 'number');
    assert.equal(typeof result.recommendation, 'string');
    assert.ok(Array.isArray(result.evidenceGaps));
    assert.equal(typeof result.decisionSuggestion, 'string');
    assert.equal(typeof result.requiresApproval, 'boolean');
  });

  it('sets requiresApproval=false for low-risk roles', () => {
    const result = buildStubOutput(LOW_RISK_INPUT);
    assert.equal(result.requiresApproval, false);
  });

  it('sets requiresApproval=true for high-risk roles', () => {
    const result = buildStubOutput(HIGH_RISK_INPUT);
    assert.equal(result.requiresApproval, true);
  });

  it('riskScore is within [0, 1]', () => {
    const result = buildStubOutput(HIGH_RISK_INPUT);
    assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  });

  it('decisionSuggestion is never APPROVED', () => {
    for (const input of [LOW_RISK_INPUT, HIGH_RISK_INPUT]) {
      const result = buildStubOutput(input);
      assert.notEqual(result.decisionSuggestion, 'APPROVED');
    }
  });
});

// ---------------------------------------------------------------------------
// parseStructuredOutput
// ---------------------------------------------------------------------------

describe('parseStructuredOutput', () => {
  const VALID_JSON = JSON.stringify({
    roleKey: 'product_analyst',
    findings: [
      {
        category: 'scope',
        severity: 'low',
        title: 'Scope is clear',
        description: 'Requirements well-defined.',
        recommendation: 'Proceed.',
      },
    ],
    affectedFiles: ['src/app/login/page.tsx'],
    riskScore: 0.2,
    recommendation: 'Task can proceed.',
    evidenceGaps: [],
    decisionSuggestion: 'CONTINUE',
    requiresApproval: false,
  });

  it('parses a valid JSON response', () => {
    const result = parseStructuredOutput(VALID_JSON, 'product_analyst');
    assert.equal(result.roleKey, 'product_analyst');
    assert.equal(result.decisionSuggestion, 'CONTINUE');
    assert.equal(result.riskScore, 0.2);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.findings.length, 1);
    assert.equal(result.affectedFiles[0], 'src/app/login/page.tsx');
  });

  it('strips markdown code fences', () => {
    const fenced = '```json\n' + VALID_JSON + '\n```';
    const result = parseStructuredOutput(fenced, 'product_analyst');
    assert.equal(result.decisionSuggestion, 'CONTINUE');
  });

  it('strips bare code fences without language tag', () => {
    const fenced = '```\n' + VALID_JSON + '\n```';
    const result = parseStructuredOutput(fenced, 'product_analyst');
    assert.equal(result.decisionSuggestion, 'CONTINUE');
  });

  it('clamps riskScore above 1.0 to 1.0', () => {
    const json = JSON.stringify({ ...JSON.parse(VALID_JSON), riskScore: 1.5, decisionSuggestion: 'CONTINUE' });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.riskScore, 1);
  });

  it('clamps riskScore below 0 to 0', () => {
    const json = JSON.stringify({ ...JSON.parse(VALID_JSON), riskScore: -0.3, decisionSuggestion: 'CONTINUE' });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.riskScore, 0);
  });

  it('throws for invalid JSON', () => {
    assert.throws(() => parseStructuredOutput('not json', 'test'), /Failed to parse JSON/);
  });

  it('throws for invalid decisionSuggestion', () => {
    const json = JSON.stringify({ ...JSON.parse(VALID_JSON), decisionSuggestion: 'APPROVED' });
    assert.throws(
      () => parseStructuredOutput(json, 'test'),
      /Invalid decisionSuggestion/,
    );
  });

  it('throws when decisionSuggestion is missing', () => {
    const parsed = JSON.parse(VALID_JSON) as Record<string, unknown>;
    delete parsed.decisionSuggestion;
    assert.throws(() => parseStructuredOutput(JSON.stringify(parsed), 'test'), /Invalid decisionSuggestion/);
  });

  it('filters out invalid findings entries', () => {
    const json = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      findings: [null, 42, { category: 'test', severity: 'low', title: 'ok', description: '', recommendation: '' }],
    });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.findings.length, 1);
  });

  it('normalises unknown finding severity to "info"', () => {
    const json = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      findings: [{ category: 'c', severity: 'extreme', title: 't', description: '', recommendation: '' }],
    });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.findings[0].severity, 'info');
  });

  it('requiresApproval coerces truthy strings to false (must be boolean true)', () => {
    const json = JSON.stringify({ ...JSON.parse(VALID_JSON), requiresApproval: 'yes' });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.requiresApproval, false);
  });

  it('requiresApproval true is preserved', () => {
    const json = JSON.stringify({ ...JSON.parse(VALID_JSON), requiresApproval: true });
    const result = parseStructuredOutput(json, 'product_analyst');
    assert.equal(result.requiresApproval, true);
  });

  it('handles all four valid decisionSuggestion values', () => {
    const decisions = ['CONTINUE', 'RUN_VALIDATION', 'SENIOR_APPROVAL_REQUIRED', 'BLOCKED'];
    for (const decision of decisions) {
      const json = JSON.stringify({ ...JSON.parse(VALID_JSON), decisionSuggestion: decision });
      const result = parseStructuredOutput(json, 'product_analyst');
      assert.equal(result.decisionSuggestion, decision);
    }
  });

  it('falls back roleKey to parameter when missing from JSON', () => {
    const parsed = JSON.parse(VALID_JSON) as Record<string, unknown>;
    delete parsed.roleKey;
    const result = parseStructuredOutput(JSON.stringify(parsed), 'fallback_key');
    assert.equal(result.roleKey, 'fallback_key');
  });
});

// ---------------------------------------------------------------------------
// runAgentRole — stub mode (FEATURE_AGENT_LLM=false)
// ---------------------------------------------------------------------------

describe('runAgentRole — stub mode', () => {
  before(() => {
    // Ensure feature flag is off (default)
    delete process.env.FEATURE_AGENT_LLM;
  });

  it('returns stub output when feature flag is off', async () => {
    const result = await runAgentRole(LOW_RISK_INPUT);
    assert.ok(result.recommendation.includes('FEATURE_AGENT_LLM=false'));
  });

  it('never returns APPROVED as decisionSuggestion in stub mode', async () => {
    const result = await runAgentRole(HIGH_RISK_INPUT);
    assert.notEqual(result.decisionSuggestion, 'APPROVED');
  });

  it('returns correct roleKey in stub mode', async () => {
    const result = await runAgentRole(LOW_RISK_INPUT);
    assert.equal(result.roleKey, LOW_RISK_INPUT.role.key);
  });
});

// ---------------------------------------------------------------------------
// runAgentRole — LLM enabled, no API key (fail-closed)
// ---------------------------------------------------------------------------

describe('runAgentRole — fail-closed when API key missing', () => {
  before(() => {
    process.env.FEATURE_AGENT_LLM = 'true';
    delete process.env.ANTHROPIC_API_KEY;
  });

  after(() => {
    delete process.env.FEATURE_AGENT_LLM;
  });

  it('throws when FEATURE_AGENT_LLM=true but ANTHROPIC_API_KEY is not set', async () => {
    await assert.rejects(
      () => runAgentRole(LOW_RISK_INPUT),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('ANTHROPIC_API_KEY'),
          `Expected message to mention ANTHROPIC_API_KEY, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('does not silently return stub output when flag is true and key missing', async () => {
    let didReject = false;
    try {
      await runAgentRole(LOW_RISK_INPUT);
    } catch {
      didReject = true;
    }
    assert.equal(didReject, true, 'Expected runAgentRole to throw, not return stub');
  });
});
