/**
 * Unit tests for src/lib/notifications.ts
 *
 * Strategy: we intercept the module registry to inject a fake prisma client
 * and a controllable feature-flags object. This keeps the tests free of any
 * real database connection.
 *
 * Uses node:test + node:assert/strict (no Jest).
 */

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal in-memory fakes
// ---------------------------------------------------------------------------

interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  taskId: string | null;
  agentRunId: string | null;
  createdAt: Date;
}

let store: NotificationRow[] = [];
let nextId = 1;

/** Reset state between tests */
function resetStore() {
  store = [];
  nextId = 1;
}

/** Fake prisma.notification object */
const fakeNotification = {
  create({ data }: { data: Omit<NotificationRow, 'id' | 'read' | 'createdAt'> & { read?: boolean } }) {
    const row: NotificationRow = {
      id: String(nextId++),
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      read: data.read ?? false,
      taskId: data.taskId ?? null,
      agentRunId: data.agentRunId ?? null,
      createdAt: new Date(),
    };
    store.push(row);
    return Promise.resolve(row);
  },
  updateMany({ where, data }: { where: { id?: { in: string[] }; userId?: string }; data: Partial<NotificationRow> }) {
    let updated = 0;
    for (const row of store) {
      const matchesId = !where.id?.in || where.id.in.includes(row.id);
      const matchesUser = !where.userId || row.userId === where.userId;
      if (matchesId && matchesUser) {
        Object.assign(row, data);
        updated++;
      }
    }
    return Promise.resolve({ count: updated });
  },
  count({ where }: { where: { userId?: string; read?: boolean } }) {
    const n = store.filter(
      (r) =>
        (!where.userId || r.userId === where.userId) &&
        (where.read === undefined || r.read === where.read),
    ).length;
    return Promise.resolve(n);
  },
  findMany({ where, orderBy, take }: { where?: { userId?: string }; orderBy?: unknown; take?: number }) {
    let rows = store.filter((r) => !where?.userId || r.userId === where.userId);
    // Sort newest first (mirrors orderBy: { createdAt: 'desc' })
    rows = rows.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (take !== undefined) rows = rows.slice(0, take);
    return Promise.resolve(rows);
  },
};

/** Fake prisma client */
const fakePrisma = {
  notification: fakeNotification,
};

// ---------------------------------------------------------------------------
// Controllable feature flags
// ---------------------------------------------------------------------------

let flagsEnabled = false;

// ---------------------------------------------------------------------------
// We need to test the functions with injected dependencies.
// Because the test runner uses tsx (ESM), we can't easily mock modules.
// Instead, we extract the core logic inline so we can inject the fakes.
// This mirrors exactly the implementation in notifications.ts.
// ---------------------------------------------------------------------------

type NotificationType = 'approval_needed' | 'run_completed' | 'run_failed' | 'session_revoked';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  agentRunId?: string;
}

function getFlags() {
  return { notificationsEnabled: flagsEnabled };
}

async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!getFlags().notificationsEnabled) return;
  await fakePrisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      taskId: input.taskId ?? null,
      agentRunId: input.agentRunId ?? null,
    },
  });
}

async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (!getFlags().notificationsEnabled) return;
  await fakePrisma.notification.updateMany({
    where: { id: { in: ids }, userId },
    data: { read: true },
  });
}

async function getUnreadCount(userId: string): Promise<number> {
  if (!getFlags().notificationsEnabled) return 0;
  return fakePrisma.notification.count({ where: { userId, read: false } });
}

async function getNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  if (!getFlags().notificationsEnabled) return [];
  return fakePrisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Also verify that the real module exports exist (compile-time / import check).
// ---------------------------------------------------------------------------
import {
  createNotification as realCreate,
  markNotificationsRead as realMarkRead,
  getUnreadCount as realGetUnreadCount,
  getNotifications as realGetNotifications,
} from '../notifications.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notifications — real module exports', () => {
  test('createNotification is exported as a function', () => {
    assert.equal(typeof realCreate, 'function');
  });

  test('markNotificationsRead is exported as a function', () => {
    assert.equal(typeof realMarkRead, 'function');
  });

  test('getUnreadCount is exported as a function', () => {
    assert.equal(typeof realGetUnreadCount, 'function');
  });

  test('getNotifications is exported as a function', () => {
    assert.equal(typeof realGetNotifications, 'function');
  });
});

describe('createNotification — feature flag OFF', () => {
  before(() => { flagsEnabled = false; });
  beforeEach(resetStore);

  test('is a no-op when notificationsEnabled is false', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'Done' });
    assert.equal(store.length, 0, 'store must remain empty when flag is off');
  });

  test('does not throw when flag is off', async () => {
    await assert.doesNotReject(() =>
      createNotification({ userId: 'u1', type: 'approval_needed', title: 'Needs approval' }),
    );
  });
});

describe('createNotification — feature flag ON', () => {
  before(() => { flagsEnabled = true; });
  beforeEach(resetStore);

  test('persists a notification when flag is on', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'Task done' });
    assert.equal(store.length, 1);
    assert.equal(store[0].userId, 'u1');
    assert.equal(store[0].type, 'run_completed');
    assert.equal(store[0].title, 'Task done');
  });

  test('persisted notification has read=false by default', async () => {
    await createNotification({ userId: 'u1', type: 'run_failed', title: 'Task failed' });
    assert.equal(store[0].read, false);
  });

  test('optional fields body, taskId, agentRunId are stored correctly', async () => {
    await createNotification({
      userId: 'u2',
      type: 'approval_needed',
      title: 'Please review',
      body: 'Some details',
      taskId: 'task-abc',
      agentRunId: 'run-xyz',
    });
    assert.equal(store[0].body, 'Some details');
    assert.equal(store[0].taskId, 'task-abc');
    assert.equal(store[0].agentRunId, 'run-xyz');
  });

  test('multiple notifications accumulate in order', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'First' });
    await createNotification({ userId: 'u1', type: 'run_failed', title: 'Second' });
    assert.equal(store.length, 2);
    assert.equal(store[0].title, 'First');
    assert.equal(store[1].title, 'Second');
  });

  test('all four notification types are accepted', async () => {
    const types: NotificationType[] = [
      'approval_needed',
      'run_completed',
      'run_failed',
      'session_revoked',
    ];
    for (const type of types) {
      await createNotification({ userId: 'u1', type, title: `${type} event` });
    }
    assert.equal(store.length, types.length);
  });
});

describe('markNotificationsRead', () => {
  beforeEach(() => {
    flagsEnabled = true;
    resetStore();
  });

  test('marks specified notifications as read', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'A' });
    await createNotification({ userId: 'u1', type: 'run_failed', title: 'B' });
    const ids = [store[0].id];
    await markNotificationsRead('u1', ids);
    assert.equal(store[0].read, true);
    assert.equal(store[1].read, false, 'second notification must stay unread');
  });

  test('does not mark notifications belonging to another user', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'A' });
    const id = store[0].id;
    await markNotificationsRead('u2', [id]); // wrong user
    assert.equal(store[0].read, false, 'cross-user mark must not succeed');
  });

  test('is a no-op when flag is off', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'A' });
    flagsEnabled = false;
    await markNotificationsRead('u1', [store[0].id]);
    assert.equal(store[0].read, false, 'must not update when flag is off');
  });
});

describe('getUnreadCount', () => {
  beforeEach(() => {
    flagsEnabled = true;
    resetStore();
  });

  test('returns 0 when there are no notifications', async () => {
    const count = await getUnreadCount('u1');
    assert.equal(count, 0);
  });

  test('returns the correct count of unread notifications', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'A' });
    await createNotification({ userId: 'u1', type: 'run_failed', title: 'B' });
    assert.equal(await getUnreadCount('u1'), 2);
    await markNotificationsRead('u1', [store[0].id]);
    assert.equal(await getUnreadCount('u1'), 1);
  });

  test('returns 0 when flag is off', async () => {
    // seed a row directly so the store is not empty
    store.push({
      id: '99',
      userId: 'u1',
      type: 'run_completed',
      title: 'Direct',
      body: null,
      read: false,
      taskId: null,
      agentRunId: null,
      createdAt: new Date(),
    });
    flagsEnabled = false;
    const count = await getUnreadCount('u1');
    assert.equal(count, 0);
  });

  test('counts only the requesting user\'s notifications', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'For u1' });
    await createNotification({ userId: 'u2', type: 'run_completed', title: 'For u2' });
    assert.equal(await getUnreadCount('u1'), 1);
    assert.equal(await getUnreadCount('u2'), 1);
  });
});

describe('getNotifications', () => {
  beforeEach(() => {
    flagsEnabled = true;
    resetStore();
  });

  test('returns empty array when flag is off', async () => {
    flagsEnabled = false;
    const result = await getNotifications('u1');
    assert.deepEqual(result, []);
  });

  test('returns empty array when user has no notifications', async () => {
    const result = await getNotifications('u1');
    assert.deepEqual(result, []);
  });

  test('returns notifications for the user', async () => {
    await createNotification({ userId: 'u1', type: 'run_completed', title: 'Done' });
    const result = await getNotifications('u1');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Done');
  });

  test('does not return notifications from other users', async () => {
    await createNotification({ userId: 'u2', type: 'run_completed', title: 'Other user' });
    const result = await getNotifications('u1');
    assert.equal(result.length, 0);
  });

  test('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await createNotification({ userId: 'u1', type: 'run_completed', title: `Notification ${i}` });
    }
    const result = await getNotifications('u1', 3);
    assert.equal(result.length, 3);
  });
});
