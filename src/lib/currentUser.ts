import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
export async function getCurrentUser() {
  const session = await getIronSession<{ userId?: string; username?: string }>(cookies(), getSessionOptions());
  if (!session.userId) return null;
  return { id: session.userId, username: session.username ?? session.userId, role: 'admin' as const };
}
