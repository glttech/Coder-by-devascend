import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions } from '@/lib/session';

async function getSession() {
  return getIronSession<{ userId?: string }>(await cookies(), getSessionOptions());
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({ prefs: prefs ?? { emailInvite: true, emailApproval: true, emailRunDone: false } });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { emailInvite, emailApproval, emailRunDone } = body;
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: session.userId },
    update: {
      ...(emailInvite !== undefined ? { emailInvite } : {}),
      ...(emailApproval !== undefined ? { emailApproval } : {}),
      ...(emailRunDone !== undefined ? { emailRunDone } : {}),
    },
    create: { userId: session.userId, emailInvite: emailInvite ?? true, emailApproval: emailApproval ?? true, emailRunDone: emailRunDone ?? false },
  });
  return NextResponse.json({ prefs });
}
