import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getIronSession<{ userId?: string }>(cookies(), getSessionOptions());
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const members = await prisma.membership.findMany({ where: { orgId: params.id } });
  return NextResponse.json({ members });
}
