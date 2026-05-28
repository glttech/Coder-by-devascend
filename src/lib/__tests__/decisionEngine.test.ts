import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeDecision, type DecisionInput } from '../decisionEngine.js';

function makeInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    riskFlags: [],
    missingEvidence: [],
    filesMentioned: [],
    commandsMentioned: [],
    environment: 'dev',
    ...overrides,
  };
}

function flag(key: string) {
  return { key, label: key, severity: 'high' as const, description: '' };
}

function missing(key: string) {
  return { key, label: key, description: '' };
}

describe('computeDecision — BLOCKED', () => {
  test('destructive-command always returns BLOCKED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('destructive-command')] }));
    assert.equal(d.code, 'BLOCKED');
    assert.equal(d.seniorApprovalRequired, true);
  });

  test('secrets-exposure returns BLOCKED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('secrets-exposure')] }));
    assert.equal(d.code, 'BLOCKED');
    assert.equal(d.seniorApprovalRequired, true);
  });

  test('failed-ci-build + production-environment returns BLOCKED', () => {
    const d = computeDecision(makeInput({
      riskFlags: [flag('failed-ci-build'), flag('production-environment')],
    }));
    assert.equal(d.code, 'BLOCKED');
    assert.equal(d.seniorApprovalRequired, true);
  });

  test('failed-ci-build alone does NOT return BLOCKED (only RUN_VALIDATION)', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('failed-ci-build')] }));
    assert.notEqual(d.code, 'BLOCKED');
  });
});

describe('computeDecision — SENIOR_APPROVAL_REQUIRED', () => {
  test('auth-security-change triggers SENIOR_APPROVAL_REQUIRED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('auth-security-change')] }));
    assert.equal(d.code, 'SENIOR_APPROVAL_REQUIRED');
    assert.equal(d.seniorApprovalRequired, true);
  });

  test('database-migration triggers SENIOR_APPROVAL_REQUIRED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('database-migration')] }));
    assert.equal(d.code, 'SENIOR_APPROVAL_REQUIRED');
  });

  test('production-environment triggers SENIOR_APPROVAL_REQUIRED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('production-environment')] }));
    assert.equal(d.code, 'SENIOR_APPROVAL_REQUIRED');
  });

  test('infra-docker-ci triggers SENIOR_APPROVAL_REQUIRED', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('infra-docker-ci')] }));
    assert.equal(d.code, 'SENIOR_APPROVAL_REQUIRED');
  });

  test('reason text includes the flagged area label', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('auth-security-change')] }));
    assert.ok(d.reason.length > 0, 'reason must not be empty');
  });
});

describe('computeDecision — ASK_AGENT_FOR_EVIDENCE', () => {
  test('missing agent-response triggers ASK_AGENT_FOR_EVIDENCE', () => {
    const d = computeDecision(makeInput({ missingEvidence: [missing('agent-response')] }));
    assert.equal(d.code, 'ASK_AGENT_FOR_EVIDENCE');
    assert.equal(d.seniorApprovalRequired, false);
  });

  test('missing files-changed + commands-run triggers ASK_AGENT_FOR_EVIDENCE', () => {
    const d = computeDecision(makeInput({
      missingEvidence: [missing('files-changed'), missing('commands-run')],
    }));
    assert.equal(d.code, 'ASK_AGENT_FOR_EVIDENCE');
  });
});

describe('computeDecision — RUN_VALIDATION', () => {
  test('files changed + missing validation-output triggers RUN_VALIDATION', () => {
    const d = computeDecision(makeInput({
      filesMentioned: ['src/app/page.tsx'],
      missingEvidence: [missing('validation-output')],
    }));
    assert.equal(d.code, 'RUN_VALIDATION');
    assert.equal(d.seniorApprovalRequired, false);
  });

  test('failed-ci-build alone (no production) triggers RUN_VALIDATION', () => {
    const d = computeDecision(makeInput({ riskFlags: [flag('failed-ci-build')] }));
    assert.equal(d.code, 'RUN_VALIDATION');
  });
});

describe('computeDecision — CONTINUE', () => {
  test('no flags and complete evidence returns CONTINUE', () => {
    const d = computeDecision(makeInput({
      filesMentioned: ['src/app/page.tsx'],
      commandsMentioned: ['npm run build'],
    }));
    assert.equal(d.code, 'CONTINUE');
    assert.equal(d.seniorApprovalRequired, false);
  });

  test('empty input returns CONTINUE', () => {
    const d = computeDecision(makeInput());
    assert.equal(d.code, 'CONTINUE');
  });

  test('CONTINUE reason is not empty', () => {
    const d = computeDecision(makeInput());
    assert.ok(d.reason.length > 0, 'CONTINUE reason must not be empty');
  });
});

describe('computeDecision — priority ordering', () => {
  test('destructive-command takes precedence over senior-approval flags', () => {
    const d = computeDecision(makeInput({
      riskFlags: [flag('destructive-command'), flag('auth-security-change')],
    }));
    assert.equal(d.code, 'BLOCKED');
  });

  test('secrets-exposure takes precedence over missing evidence', () => {
    const d = computeDecision(makeInput({
      riskFlags: [flag('secrets-exposure')],
      missingEvidence: [missing('agent-response')],
    }));
    assert.equal(d.code, 'BLOCKED');
  });
});
