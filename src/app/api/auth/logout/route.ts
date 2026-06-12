import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';
import { revokeActiveSession } from '@/lib/sessionStore';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getIronSession<AppSession>(await cookies(), getSessionOptions());

  // Revoke the DB-backed session row so the cookie, even if replayed, is rejected.
  if (session.sessionId) {
    try {
      await revokeActiveSession(session.sessionId);
    } catch {
      // DB unavailable — still destroy the cookie so the user is logged out locally.
    }
  }

  session.destroy();
  return NextResponse.json({ ok: true });
}
