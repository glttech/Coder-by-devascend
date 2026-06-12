import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getAuthMode, getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';
import { generateCsrfToken } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mode = getAuthMode();

  if (mode === 'disabled') {
    // Auth disabled — return a static placeholder; CSRF is not enforced.
    return NextResponse.json({ csrfToken: null });
  }

  if (mode === 'misconfigured') {
    return NextResponse.json({ error: 'Server auth configuration error.' }, { status: 500 });
  }

  const session = await getIronSession<AppSession>(await cookies(), getSessionOptions());

  if (!session.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Generate a new CSRF token if one is not already stored in the session.
  if (!session.csrfToken) {
    session.csrfToken = await generateCsrfToken();
    await session.save();
  }

  const response = NextResponse.json({ csrfToken: session.csrfToken });

  // Set a non-HttpOnly cookie so client JS can read the token.
  response.cookies.set('csrf-token', session.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
