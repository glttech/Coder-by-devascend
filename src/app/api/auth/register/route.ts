import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';
import { checkLoginRateLimit } from '@/lib/loginRateLimit';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rateLimit = checkLoginRateLimit(`register:${ip}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Try again in ${Math.ceil(rateLimit.retryAfterMs / 60000)} minutes.` },
      { status: 429 }
    );
  }

  let email: string;
  let password: string;
  let confirmPassword: string;

  try {
    const body = await req.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    password = typeof body.password === 'string' ? body.password : '';
    confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  if (password.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  const session = await getIronSession<AppSession>(cookies(), getSessionOptions());
  session.userId = user.id;
  session.username = user.email;
  session.loginAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true }, { status: 201 });
}
