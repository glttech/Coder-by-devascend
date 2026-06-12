import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getAuthMode, getSessionOptions, parseSessionMaxAge } from '@/lib/session';
import type { AppSession, UserRole } from '@/lib/session';
import { checkLoginRateLimit, resetLoginRateLimit } from '@/lib/loginRateLimit';
import prisma from '@/lib/prisma';
import { createActiveSession } from '@/lib/sessionStore';

export const dynamic = 'force-dynamic';

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

export async function POST(req: NextRequest) {
  const mode = getAuthMode();

  if (mode === 'disabled') {
    return NextResponse.json({ error: 'Auth is disabled on this server.' }, { status: 400 });
  }

  if (mode === 'misconfigured') {
    console.error('[auth] Misconfigured: ADMIN_USERNAME or ADMIN_PASSWORD_HASH is set without the other.');
    return NextResponse.json({ error: 'Server auth configuration error. Contact the server admin.' }, { status: 500 });
  }

  const ip = getClientIP(req);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
      { status: 429 },
    );
  }

  let username: string;
  let password: string;
  try {
    const body = await req.json();
    username = typeof body.username === 'string' ? body.username : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const expectedUsername = process.env.ADMIN_USERNAME!;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH!;

  // Always run bcrypt to prevent timing-based username enumeration.
  const hashToCompare = expectedHash || '$2b$12$invalidhashpadding000000000000000000000000000000000000';
  const passwordMatch = await bcrypt.compare(password, hashToCompare);
  const usernameMatch = username === expectedUsername;

  if (!usernameMatch || !passwordMatch) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  resetLoginRateLimit(ip);

  // Look up the User record by email to get the real UUID and role.
  // Fall back to 'admin-unseed' / 'admin' when the DB hasn't been seeded yet,
  // so login still works even before `npm run seed:admin` has been run.
  let userId = 'admin-unseed';
  let role: UserRole = 'admin';
  try {
    const user = await prisma.user.findUnique({ where: { email: expectedUsername } });
    if (user) {
      userId = user.id;
      role = (user.role as UserRole) ?? 'admin';
    }
  } catch {
    // DB unavailable or not migrated yet — continue with fallback values.
  }

  const sessionId = randomUUID();
  const opts = getSessionOptions();
  const { hours: ttlHours } = parseSessionMaxAge(process.env.SESSION_MAX_AGE_HOURS);

  // Persist session to DB allowlist so logout and revocation actually work.
  // If DB is unavailable, skip silently — the iron-session cookie is still set.
  try {
    await createActiveSession(userId, sessionId, ttlHours);
  } catch {
    // DB unavailable or not yet migrated — continue without DB-backed session.
    // Sessions created without a DB row will fail validateActiveSession checks
    // but the middleware cookie check will still pass.
  }

  const session = await getIronSession<AppSession>(await cookies(), opts);
  session.userId = userId;
  session.username = expectedUsername;
  session.role = role;
  session.loginAt = new Date().toISOString();
  session.sessionId = sessionId;
  await session.save();

  return NextResponse.json({ ok: true });
}
