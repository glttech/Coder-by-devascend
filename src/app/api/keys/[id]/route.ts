import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

// DELETE /api/keys/[id] — revoke an API key
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
  if (!key || key.orgId !== 'org_default') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.apiKey.update({ where: { id: params.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
