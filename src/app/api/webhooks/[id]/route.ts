import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  await prisma.webhook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const { enabled } = await request.json() as { enabled: boolean };
  const webhook = await prisma.webhook.update({ where: { id: params.id }, data: { enabled } });
  return NextResponse.json({ webhook });
}
