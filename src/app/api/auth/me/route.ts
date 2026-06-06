import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getAuthMode, getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mode = getAuthMode();

  if (mode === 'disabled') {
    return NextResponse.json({ authenticated: true, username: null, loginAt: null, authDisabled: true });
  }

  if (mode === 'misconfigured') {
    return NextResponse.json({ error: 'Server auth configuration error.' }, { status: 500 });
  }

  const session = await getIronSession<AppSession>(cookies(), getSessionOptions());
  if (!session.userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
    loginAt: session.loginAt,
  });
}
