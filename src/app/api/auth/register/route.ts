import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { checkLoginRateLimit } from '@/lib/loginRateLimit';
import { createActiveSession } from '@/lib/sessionStore';
import { parseSessionMaxAge } from '@/lib/session';

export const dynamic = 'force-dynamic';

const COMMON_PASSWORDS = new Set([
  'password123', 'password1', '123456789', 'qwerty123', 'iloveyou',
  'admin1234', 'welcome1', 'monkey123', 'dragon123', 'master123',
]);

function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Password is too common';
  return null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = checkLoginRateLimit(ip);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: { email?: string; password?: string; name?: string; orgName?: string };
  try {
    body = await request.json() as { email?: string; password?: string; name?: string; orgName?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, name, orgName } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  // Hash first for timing-safety — attacker can't distinguish "bad email format"
  // from "email already registered" via response time.
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    // Uniform timing — don't reveal whether email exists
    return NextResponse.json({ error: 'Registration failed. Please check your details.' }, { status: 409 });
  }

  // Generate org slug from orgName or email prefix
  const baseSlug = (orgName ?? email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 38) || 'workspace';

  // Make slug unique
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Create user + org + membership in a transaction
  const { newUser, orgId } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name: name?.trim() || email.split('@')[0],
        role: 'admin',
        passwordHash,
      },
    });

    const org = await tx.organization.create({
      data: {
        name: orgName?.trim() || `${createdUser.name}'s Workspace`,
        slug,
        plan: 'free',
        memberships: {
          create: { userId: createdUser.id, role: 'owner' },
        },
      },
    });

    return { newUser: createdUser, orgId: org.id };
  });

  // Issue session
  const sessionId = randomUUID();
  const opts = getSessionOptions();
  const { hours: ttlHours } = parseSessionMaxAge(process.env.SESSION_MAX_AGE_HOURS);

  // Persist session to DB allowlist (best-effort — skip if DB unavailable)
  try {
    await createActiveSession(newUser.id, sessionId, ttlHours);
  } catch {
    // Continue without DB-backed session tracking
  }

  const session = await getIronSession<AppSession>(await cookies(), opts);
  session.userId = newUser.id;
  session.username = newUser.email;
  session.role = 'admin';
  session.loginAt = new Date().toISOString();
  session.sessionId = sessionId;
  await session.save();

  return NextResponse.json({ ok: true, userId: newUser.id, orgId }, { status: 201 });
}
