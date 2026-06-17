import type { Notification } from '@prisma/client';
import prisma from '@/lib/db';
import { getFeatureFlags } from '@/lib/featureFlags';

export type NotificationType =
  | 'approval_needed'
  | 'run_completed'
  | 'run_failed'
  | 'session_revoked';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  agentRunId?: string;
}

/**
 * Persist a new notification for a user.
 * No-op when the `notificationsEnabled` feature flag is off.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!getFeatureFlags().notificationsEnabled) return;

  await prisma.notification.create({
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

/**
 * Mark a list of notifications as read for the given user.
 * No-op when the `notificationsEnabled` feature flag is off.
 */
export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (!getFeatureFlags().notificationsEnabled) return;

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId },
    data: { read: true },
  });
}

/**
 * Return the count of unread notifications for a user.
 * Returns 0 when the `notificationsEnabled` feature flag is off.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!getFeatureFlags().notificationsEnabled) return 0;

  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Return recent notifications for a user (newest first).
 * Returns an empty array when the `notificationsEnabled` feature flag is off.
 */
export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  if (!getFeatureFlags().notificationsEnabled) return [];

  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
