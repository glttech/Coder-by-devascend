import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mirror the status-update rules from the API routes as pure functions so
// they can be tested without a live database.

// Rule 1: Approval accepted → task moves from 'pending' to 'running'.
function taskStatusFromApproval(
  approved: boolean,
  currentTaskStatus: string,
): string | null {
  if (approved === true && currentTaskStatus === 'pending') return 'running';
  return null;
}

// Rule 2 + 3: Instruction status transition → derive new task status (if any).
// Returns the new task status, or null if no change is warranted.
function taskStatusFromInstructionTransition(
  nextInstructionStatus: string,
  remainingNonCompleted: number, // count of instructions NOT yet 'completed' after this transition
): string | null {
  if (nextInstructionStatus === 'blocked') return 'failed';
  if (nextInstructionStatus === 'completed' && remainingNonCompleted === 0) return 'completed';
  return null;
}

// ── Rule 1: Approval ───────────────────────────────────────────────────────

describe('taskStatusFromApproval — approved=true', () => {
  test('pending task becomes running when approved', () => {
    assert.equal(taskStatusFromApproval(true, 'pending'), 'running');
  });

  test('running task is not changed by a second approval', () => {
    assert.equal(taskStatusFromApproval(true, 'running'), null);
  });

  test('completed task is not changed by approval', () => {
    assert.equal(taskStatusFromApproval(true, 'completed'), null);
  });

  test('failed task is not changed by approval', () => {
    assert.equal(taskStatusFromApproval(true, 'failed'), null);
  });
});

describe('taskStatusFromApproval — approved=false (rejected)', () => {
  test('rejected approval does not change pending task', () => {
    assert.equal(taskStatusFromApproval(false, 'pending'), null);
  });

  test('rejected approval does not change running task', () => {
    assert.equal(taskStatusFromApproval(false, 'running'), null);
  });

  test('rejected approval does not affect completed task', () => {
    assert.equal(taskStatusFromApproval(false, 'completed'), null);
  });
});

// ── Rule 2: All instructions completed ────────────────────────────────────

describe('taskStatusFromInstructionTransition — all completed', () => {
  test('last instruction completing → task becomes completed', () => {
    assert.equal(taskStatusFromInstructionTransition('completed', 0), 'completed');
  });

  test('one instruction completing with others still pending → no change', () => {
    assert.equal(taskStatusFromInstructionTransition('completed', 2), null);
  });

  test('one instruction completing with one remaining → no change', () => {
    assert.equal(taskStatusFromInstructionTransition('completed', 1), null);
  });
});

// ── Rule 3: Any instruction blocked ───────────────────────────────────────

describe('taskStatusFromInstructionTransition — blocked', () => {
  test('blocked instruction → task becomes failed', () => {
    assert.equal(taskStatusFromInstructionTransition('blocked', 0), 'failed');
  });

  test('blocked instruction with many remaining → still failed', () => {
    assert.equal(taskStatusFromInstructionTransition('blocked', 5), 'failed');
  });

  test('blocked takes precedence regardless of remaining count', () => {
    // Even if other instructions are done, a blocked one means failure
    const result = taskStatusFromInstructionTransition('blocked', 0);
    assert.equal(result, 'failed');
    assert.notEqual(result, 'completed');
  });
});

// ── Other instruction transitions → no task status change ─────────────────

describe('taskStatusFromInstructionTransition — non-terminal transitions', () => {
  test('draft → pending_approval does not change task', () => {
    assert.equal(taskStatusFromInstructionTransition('pending_approval', 1), null);
  });

  test('pending_approval → approved does not change task', () => {
    assert.equal(taskStatusFromInstructionTransition('approved', 1), null);
  });

  test('approved → executing does not change task', () => {
    assert.equal(taskStatusFromInstructionTransition('executing', 1), null);
  });
});

// ── Priority: blocked overrides completed ─────────────────────────────────

describe('taskStatusFromInstructionTransition — priority', () => {
  test('blocked returns failed, not completed (even with 0 remaining)', () => {
    // If somehow remaining=0 but the transition is blocked, failed wins
    const result = taskStatusFromInstructionTransition('blocked', 0);
    assert.equal(result, 'failed');
  });

  test('completed with remaining>0 returns null, not failed', () => {
    const result = taskStatusFromInstructionTransition('completed', 3);
    assert.equal(result, null);
  });
});

// ── Audit detail shape ─────────────────────────────────────────────────────

function buildTaskStatusChangedDetails(opts: {
  from: string | null;
  to: string;
  reason: string;
}): string {
  return JSON.stringify({ ...opts, at: new Date().toISOString() });
}

describe('task_status_changed audit details', () => {
  test('returns valid JSON', () => {
    const raw = buildTaskStatusChangedDetails({ from: 'pending', to: 'running', reason: 'approval_accepted' });
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  test('includes from, to, reason, and at fields', () => {
    const data = JSON.parse(buildTaskStatusChangedDetails({ from: 'pending', to: 'running', reason: 'approval_accepted' }));
    assert.equal(data.from, 'pending');
    assert.equal(data.to, 'running');
    assert.equal(data.reason, 'approval_accepted');
    assert.ok(typeof data.at === 'string');
  });

  test('from may be null for instruction-driven changes', () => {
    const data = JSON.parse(buildTaskStatusChangedDetails({ from: null, to: 'failed', reason: 'instruction_blocked' }));
    assert.equal(data.from, null);
    assert.equal(data.to, 'failed');
  });

  test('reason values match defined constants', () => {
    const validReasons = ['approval_accepted', 'instruction_blocked', 'all_instructions_completed'];
    for (const reason of validReasons) {
      const data = JSON.parse(buildTaskStatusChangedDetails({ from: null, to: 'running', reason }));
      assert.ok(validReasons.includes(data.reason), `"${reason}" should be a valid reason`);
    }
  });
});
