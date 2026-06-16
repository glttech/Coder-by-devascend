import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const wh = await prisma.webhook.findUnique({ where: { id: params.id } });
  if (!wh || wh.orgId !== 'org_default') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.webhook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const wh = await prisma.webhook.findUnique({ where: { id: params.id } });
  if (!wh || wh.orgId !== 'org_default') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json() as { enabled?: boolean };
  const updated = await prisma.webhook.update({ where: { id: params.id }, data: { enabled: body.enabled } });
  return NextResponse.json(updated);
}
