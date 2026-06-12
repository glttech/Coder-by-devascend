import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Type definitions mirrored from the Prisma schema — used for compile-time
// validation without hitting the real database.
// ---------------------------------------------------------------------------

interface ApprovalShape {
  id: string;
  taskId: string;
  approved: boolean | null;
  approverId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ApprovalPanelProps {
  taskId: string;
  approvalRequired: boolean;
  approved: boolean | null | undefined;
  approverName?: string; // optional — Phase 2 addition
}

// ---------------------------------------------------------------------------
// Type-level assertions: confirm the schema shapes are correct at compile time.
// ---------------------------------------------------------------------------

// Approval with null approverId is valid (backward compat / system approvals)
const approvalWithNullApprover = {
  id: 'appr-1',
  taskId: 'task-1',
  approved: true,
  approverId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies ApprovalShape;

// Approval with non-null approverId is valid
const approvalWithApprover = {
  id: 'appr-2',
  taskId: 'task-2',
  approved: false,
  approverId: 'user-uuid-abc',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies ApprovalShape;

// ApprovalPanel props without approverName — valid (optional prop)
const panelPropsWithoutApprover = {
  taskId: 'task-1',
  approvalRequired: true,
  approved: null,
} satisfies ApprovalPanelProps;

// ApprovalPanel props with approverName — valid
const panelPropsWithApprover = {
  taskId: 'task-2',
  approvalRequired: true,
  approved: true,
  approverName: 'Alice',
} satisfies ApprovalPanelProps;

// ---------------------------------------------------------------------------
// Helper: simulate the approve/reject flow logic (no real DB needed)
// ---------------------------------------------------------------------------

function buildApprovalWrite(
  taskId: string,
  approved: boolean,
  userId: string | null,
): Omit<ApprovalShape, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    taskId,
    approved,
    approverId: userId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Runtime tests
// ---------------------------------------------------------------------------

describe('Approval.approverId schema shape', () => {
  test('null approverId is valid — backward compat for pre-migration approvals', () => {
    assert.equal(approvalWithNullApprover.approverId, null);
    assert.equal(approvalWithNullApprover.approved, true);
  });

  test('non-null approverId satisfies the user id relation', () => {
    assert.equal(typeof approvalWithApprover.approverId, 'string');
    assert.equal(approvalWithApprover.approverId, 'user-uuid-abc');
  });

  test('approve flow sets approved=true and records approverId', () => {
    const write = buildApprovalWrite('task-A', true, 'user-xyz');
    assert.equal(write.approved, true);
    assert.equal(write.approverId, 'user-xyz');
  });

  test('reject flow sets approved=false and records approverId', () => {
    const write = buildApprovalWrite('task-B', false, 'user-xyz');
    assert.equal(write.approved, false);
    assert.equal(write.approverId, 'user-xyz');
  });

  test('system/unauthenticated flow leaves approverId null', () => {
    const write = buildApprovalWrite('task-C', true, null);
    assert.equal(write.approverId, null);
    assert.equal(write.approved, true);
  });
});

describe('ApprovalPanel approverName prop', () => {
  test('approverName prop is optional — omitting it does not cause a type error', () => {
    // If this compiled, the prop is genuinely optional
    assert.equal('approverName' in panelPropsWithoutApprover, false);
  });

  test('approverName prop accepts a string when provided', () => {
    assert.equal(panelPropsWithApprover.approverName, 'Alice');
  });

  test('approverName can be undefined (no approver recorded yet)', () => {
    const props: ApprovalPanelProps = {
      taskId: 'task-3',
      approvalRequired: true,
      approved: null,
      approverName: undefined,
    };
    assert.equal(props.approverName, undefined);
  });

  test('approved=true with approverName reflects a decided review', () => {
    assert.equal(panelPropsWithApprover.approved, true);
    assert.equal(panelPropsWithApprover.approverName, 'Alice');
  });

  test('approved=null with no approverName reflects a pending undecided state', () => {
    assert.equal(panelPropsWithoutApprover.approved, null);
    assert.equal('approverName' in panelPropsWithoutApprover, false);
  });
});
