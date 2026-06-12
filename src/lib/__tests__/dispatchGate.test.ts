import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDispatch, type DispatchContext } from '../dispatchGate.js';

function makeCtx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    approvalRequired: false,
    riskLevel: 'low',
    orchestrationEnabled: true,
    ...overrides,
  };
}

describe('resolveDispatch — feature flag off', () => {
  it('rejects when orchestrationEnabled is false', () => {
    const result = resolveDispatch(makeCtx({ orchestrationEnabled: false }));
    assert.equal(result.action, 'reject');
    if (result.action === 'reject') {
      assert.equal(result.reason, 'Orchestration feature is disabled');
    }
  });

  it('rejects even if approvalRequired is true and flag is off', () => {
    const result = resolveDispatch(makeCtx({ orchestrationEnabled: false, approvalRequired: true }));
    assert.equal(result.action, 'reject');
  });

  it('rejects even if riskLevel is high and flag is off', () => {
    const result = resolveDispatch(makeCtx({ orchestrationEnabled: false, riskLevel: 'high' }));
    assert.equal(result.action, 'reject');
  });
});

describe('resolveDispatch — await_approval cases', () => {
  it('returns await_approval when approvalRequired is true and flag is on', () => {
    const result = resolveDispatch(makeCtx({ approvalRequired: true }));
    assert.equal(result.action, 'await_approval');
    if (result.action === 'await_approval') {
      assert.ok(result.reason.length > 0, 'reason must be non-empty');
    }
  });

  it('returns await_approval when riskLevel is high and flag is on', () => {
    const result = resolveDispatch(makeCtx({ riskLevel: 'high' }));
    assert.equal(result.action, 'await_approval');
    if (result.action === 'await_approval') {
      assert.ok(result.reason.length > 0, 'reason must be non-empty');
    }
  });

  it('returns await_approval when both approvalRequired and riskLevel high', () => {
    const result = resolveDispatch(makeCtx({ approvalRequired: true, riskLevel: 'high' }));
    assert.equal(result.action, 'await_approval');
  });
});

describe('resolveDispatch — queue cases', () => {
  it('queues when riskLevel is low and approvalRequired false and flag on', () => {
    const result = resolveDispatch(makeCtx({ riskLevel: 'low', approvalRequired: false }));
    assert.equal(result.action, 'queue');
  });

  it('queues when riskLevel is medium and approvalRequired false', () => {
    const result = resolveDispatch(makeCtx({ riskLevel: 'medium', approvalRequired: false }));
    assert.equal(result.action, 'queue');
  });

  it('queues when riskLevel is medium explicitly and flag on', () => {
    const result = resolveDispatch(makeCtx({ riskLevel: 'medium' }));
    assert.equal(result.action, 'queue');
  });
});

describe('resolveDispatch — flag precedence', () => {
  it('flag-off rejection takes precedence over approvalRequired', () => {
    const result = resolveDispatch(
      makeCtx({ orchestrationEnabled: false, approvalRequired: true, riskLevel: 'high' }),
    );
    assert.equal(result.action, 'reject');
  });
});
