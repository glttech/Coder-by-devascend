import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { AuditEntry } from '../audit';

// ---------------------------------------------------------------------------
// Type-level assertions using the `satisfies` operator.
// These are compile-time checks — if the AuditEntry type changes in a
// breaking way, TypeScript will error here before any tests run.
// ---------------------------------------------------------------------------

// AuditEntry with userId omitted is valid (backward compat)
const entryWithoutUserId = {
  event: 'task_created',
  details: 'some details',
  taskId: 'task-abc',
} satisfies AuditEntry;

// AuditEntry with userId: null is valid (machine / system actions)
const entryWithNullUserId = {
  event: 'github_pr_refreshed',
  userId: null,
} satisfies AuditEntry;

// AuditEntry with userId: string is valid (authenticated user actions)
const entryWithStringUserId = {
  event: 'task_approval_decided',
  userId: 'user-uuid-1234',
} satisfies AuditEntry;

// AuditEntry with all optional fields is valid
const entryWithAllFields = {
  event: 'instruction_created',
  details: 'detail string',
  taskId: 'task-1',
  agentRunId: 'run-1',
  operatorSessionId: 'session-1',
  instructionId: 'instr-1',
  userId: 'user-1',
} satisfies AuditEntry;

// ---------------------------------------------------------------------------
// Runtime tests
// ---------------------------------------------------------------------------

describe('AuditEntry type shape', () => {
  test('AuditEntry without userId is valid (backward compat)', () => {
    // If this line compiled, the type accepts a missing userId
    assert.equal(entryWithoutUserId.event, 'task_created');
    assert.equal('userId' in entryWithoutUserId, false);
  });

  test('AuditEntry with userId null is valid', () => {
    assert.equal(entryWithNullUserId.userId, null);
  });

  test('AuditEntry with userId as string is valid', () => {
    assert.equal(typeof entryWithStringUserId.userId, 'string');
    assert.equal(entryWithStringUserId.userId, 'user-uuid-1234');
  });

  test('AuditEntry with all optional fields populates correctly', () => {
    assert.equal(entryWithAllFields.taskId, 'task-1');
    assert.equal(entryWithAllFields.agentRunId, 'run-1');
    assert.equal(entryWithAllFields.operatorSessionId, 'session-1');
    assert.equal(entryWithAllFields.instructionId, 'instr-1');
    assert.equal(entryWithAllFields.userId, 'user-1');
  });

  test('AuditEntry required field is event', () => {
    // The only required field is event; all others are optional
    const minimalEntry: AuditEntry = { event: 'minimal_event' };
    assert.equal(minimalEntry.event, 'minimal_event');
    assert.equal(minimalEntry.userId, undefined);
    assert.equal(minimalEntry.taskId, undefined);
  });
});

describe('writeAudit function contract', () => {
  test('writeAudit is exported as an async function', async () => {
    // Import dynamically to avoid triggering real Prisma initialization
    // in the test environment where DATABASE_URL may not be set.
    // We only check that the export is a function, not that it writes to DB.
    const mod = await import('../audit');
    assert.equal(typeof mod.writeAudit, 'function');
    // async functions return a Promise; constructors are named AsyncFunction
    assert.equal(mod.writeAudit.constructor.name, 'AsyncFunction');
  });

  test('AuditEntry is re-exported from audit module', async () => {
    // Type exports are erased at runtime, but the module itself should load
    const mod = await import('../audit');
    // writeAudit is the named export we care about; module should load without error
    assert.ok(mod.writeAudit !== undefined);
  });

  test('writeAudit accepts entry without userId (no type error at call site)', async () => {
    // This test is compile-time: if userId were required, this line would fail tsc.
    // At runtime we skip the actual DB call by not invoking the function.
    const buildCall = () => {
      const entry: AuditEntry = { event: 'task_created', taskId: 'test-task' };
      // Confirm shape is valid — do NOT call writeAudit here (would need DB)
      assert.ok(entry.event === 'task_created');
      assert.equal(entry.userId, undefined);
    };
    assert.doesNotThrow(buildCall);
  });

  test('writeAudit accepts entry with userId: null (system action pattern)', () => {
    const buildCall = () => {
      const entry: AuditEntry = { event: 'github_pr_refreshed', userId: null };
      assert.equal(entry.userId, null);
    };
    assert.doesNotThrow(buildCall);
  });

  test('writeAudit accepts entry with userId: uuid string (user action pattern)', () => {
    const buildCall = () => {
      const entry: AuditEntry = { event: 'task_edited', userId: 'aaaa-bbbb-cccc-dddd' };
      assert.equal(entry.userId, 'aaaa-bbbb-cccc-dddd');
    };
    assert.doesNotThrow(buildCall);
  });
});
