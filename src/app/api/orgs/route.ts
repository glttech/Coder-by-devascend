import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getIronSession<{ userId?: string }>(cookies(), getSessionOptions());
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ orgs });
}

export async function POST(req: Request) {
  const session = await getIronSession<{ userId?: string }>(cookies(), getSessionOptions());
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, slug } = await req.json();
  if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 });
  const org = await prisma.organization.create({ data: { name, slug } });
  await prisma.membership.create({ data: { orgId: org.id, userId: session.userId, role: 'owner' } });
  return NextResponse.json({ org }, { status: 201 });
}
