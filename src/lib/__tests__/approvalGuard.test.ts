import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkApprovalAllowed, type ApprovalGuardInput } from '../approvalGuard.js';

function makeInput(overrides: Partial<ApprovalGuardInput> = {}): ApprovalGuardInput {
  return {
    taskExists: true,
    approvalRequired: true,
    taskStatus: 'pending',
    existingApproved: null,
    ...overrides,
  };
}

describe('checkApprovalAllowed — valid awaiting-approval', () => {
  test('task awaiting approval (pending, required, no decision) is allowed', () => {
    const result = checkApprovalAllowed(makeInput());
    assert.equal(result.ok, true);
  });

  test('task in running state still awaiting approval is allowed', () => {
    const result = checkApprovalAllowed(makeInput({ taskStatus: 'running' }));
    assert.equal(result.ok, true);
  });
});

describe('checkApprovalAllowed — already decided is rejected', () => {
  test('already approved task is rejected with 409', () => {
    const result = checkApprovalAllowed(makeInput({ existingApproved: true }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  test('already rejected task is rejected with 409', () => {
    const result = checkApprovalAllowed(makeInput({ existingApproved: false }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  test('re-approval (the bypass attempt) cannot change an existing decision', () => {
    // A second approval call on a task already approved must not succeed.
    const result = checkApprovalAllowed(makeInput({ existingApproved: true }));
    assert.equal(result.ok, false);
  });
});

describe('checkApprovalAllowed — terminal task states are rejected', () => {
  test('completed task is rejected with 409', () => {
    const result = checkApprovalAllowed(makeInput({ taskStatus: 'completed' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  test('failed task is rejected with 409', () => {
    const result = checkApprovalAllowed(makeInput({ taskStatus: 'failed' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });
});

describe('checkApprovalAllowed — missing/invalid target is rejected', () => {
  test('non-existent task is rejected with 404', () => {
    const result = checkApprovalAllowed(makeInput({ taskExists: false }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  test('task that does not require approval is rejected with 422', () => {
    const result = checkApprovalAllowed(makeInput({ approvalRequired: false }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 422);
  });
});

describe('checkApprovalAllowed — direct API bypass attempt', () => {
  test('bypass on a non-approval task is blocked even with valid-looking input', () => {
    // Attacker posts {taskId, approved:true} to a task that never required approval.
    const result = checkApprovalAllowed(
      makeInput({ approvalRequired: false, taskStatus: 'completed', existingApproved: null }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.status === 422 || result.status === 409);
  });

  test('bypass to flip an already-approved decision is blocked', () => {
    const result = checkApprovalAllowed(makeInput({ existingApproved: true, taskStatus: 'running' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  test('error messages are present and non-empty for all rejections', () => {
    const cases: ApprovalGuardInput[] = [
      makeInput({ taskExists: false }),
      makeInput({ approvalRequired: false }),
      makeInput({ taskStatus: 'completed' }),
      makeInput({ existingApproved: true }),
    ];
    for (const c of cases) {
      const result = checkApprovalAllowed(c);
      assert.equal(result.ok, false);
      if (!result.ok) assert.ok(result.error.length > 0, 'rejection must include an error message');
    }
  });
});

describe('checkApprovalAllowed — precedence', () => {
  test('missing task takes precedence over every other rule', () => {
    const result = checkApprovalAllowed(
      makeInput({ taskExists: false, approvalRequired: false, taskStatus: 'completed', existingApproved: true }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  test('approvalRequired=false takes precedence over terminal/decided', () => {
    const result = checkApprovalAllowed(
      makeInput({ approvalRequired: false, taskStatus: 'completed', existingApproved: true }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 422);
  });
});
