import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRiskGate, type RiskGateInput } from '../riskGate.js';

function makeInput(overrides: Partial<RiskGateInput> = {}): RiskGateInput {
  return {
    riskLevel: 'low',
    environment: 'dev',
    approvalRequired: false,
    hasApproval: false,
    promptScore: 0.8,
    ...overrides,
  };
}

describe('checkRiskGate — high-risk without approval blocked', () => {
  it('high-risk run without approval is blocked', () => {
    const result = checkRiskGate(makeInput({ riskLevel: 'high', hasApproval: false }));
    assert.equal(result.allowed, false);
    assert.ok(
      result.blockedReasons.includes('High-risk run requires approval'),
      'should include high-risk approval reason',
    );
  });
});

describe('checkRiskGate — high-risk with approval allowed', () => {
  it('high-risk run with approval is allowed (assuming good prompt score)', () => {
    const result = checkRiskGate(makeInput({ riskLevel: 'high', hasApproval: true }));
    assert.equal(result.allowed, true);
    assert.equal(result.blockedReasons.length, 0);
  });
});

describe('checkRiskGate — production non-low-risk without approval blocked', () => {
  it('medium-risk production run without approval is blocked', () => {
    const result = checkRiskGate(
      makeInput({ riskLevel: 'medium', environment: 'production', hasApproval: false }),
    );
    assert.equal(result.allowed, false);
    assert.ok(
      result.blockedReasons.includes('Non-low-risk production run requires approval'),
      'should include production approval reason',
    );
  });

  it('high-risk production run without approval includes both high-risk and production reasons', () => {
    const result = checkRiskGate(
      makeInput({ riskLevel: 'high', environment: 'production', hasApproval: false }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.blockedReasons.includes('High-risk run requires approval'));
    assert.ok(result.blockedReasons.includes('Non-low-risk production run requires approval'));
  });

  it('low-risk production run without approval is allowed', () => {
    const result = checkRiskGate(
      makeInput({ riskLevel: 'low', environment: 'production', hasApproval: false }),
    );
    assert.equal(result.allowed, true);
    assert.equal(result.blockedReasons.length, 0);
  });
});

describe('checkRiskGate — low prompt score blocked', () => {
  it('prompt score below 0.5 is blocked', () => {
    const result = checkRiskGate(makeInput({ promptScore: 0.3 }));
    assert.equal(result.allowed, false);
    assert.ok(
      result.blockedReasons.includes('Prompt quality score too low'),
      'should include prompt quality reason',
    );
  });

  it('prompt score exactly 0.5 is not blocked', () => {
    const result = checkRiskGate(makeInput({ promptScore: 0.5 }));
    assert.equal(result.allowed, true);
    assert.ok(
      !result.blockedReasons.includes('Prompt quality score too low'),
      'score of 0.5 should not be blocked',
    );
  });
});

describe('checkRiskGate — all clear allowed', () => {
  it('low-risk dev run with good prompt score is allowed', () => {
    const result = checkRiskGate(
      makeInput({ riskLevel: 'low', environment: 'dev', hasApproval: false, promptScore: 0.9 }),
    );
    assert.equal(result.allowed, true);
    assert.equal(result.blockedReasons.length, 0);
  });

  it('medium-risk staging run with approval and good prompt score is allowed', () => {
    const result = checkRiskGate(
      makeInput({
        riskLevel: 'medium',
        environment: 'staging',
        hasApproval: true,
        promptScore: 1.0,
      }),
    );
    assert.equal(result.allowed, true);
    assert.equal(result.blockedReasons.length, 0);
  });
});
