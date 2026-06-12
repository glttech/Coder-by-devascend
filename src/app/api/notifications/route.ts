import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getFeatureFlags } from '@/lib/featureFlags';
import {
  getNotifications,
  getUnreadCount,
  markNotificationsRead,
} from '@/lib/notifications';

/**
 * GET /api/notifications
 * Returns { notifications, unreadCount } for the authenticated user.
 * Requires authentication and the notificationsEnabled feature flag.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getFeatureFlags().notificationsEnabled) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.userId),
    getUnreadCount(user.userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

/**
 * POST /api/notifications
 * Body: { ids: string[] }
 * Marks the given notification IDs as read for the authenticated user.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getFeatureFlags().notificationsEnabled) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  const body = await request.json();
  const { ids } = body as { ids: string[] };

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids must be an array of strings' }, { status: 400 });
  }

  await markNotificationsRead(user.userId, ids);

  return NextResponse.json({ ok: true });
}
