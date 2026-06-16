/**
 * getCurrentUser — returns a minimal user object from the iron-session,
 * or null when unauthenticated / auth is disabled.
 *
 * This module is server-only (Next.js App Router route handlers / Server
 * Components).  Do NOT import it in client components.
 */
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getAuthMode, getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const mode = getAuthMode();

  // Auth disabled → treat every request as a privileged admin.
  if (mode === 'disabled') {
    return { id: 'system', username: 'admin', role: 'admin' };
  }

  if (mode === 'misconfigured') {
    return null;
  }

  const session = await getIronSession<AppSession>(cookies(), getSessionOptions());
  if (!session.userId) return null;

  return { id: session.userId, username: session.username ?? 'admin', role: 'admin' };
}
