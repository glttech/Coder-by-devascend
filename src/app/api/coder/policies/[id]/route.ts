import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { validateCommandPolicyPatch } from '@/lib/coder/commandPolicy';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const policy = await prisma.commandPolicy.findUnique({ where: { id: params.id } });
  if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  return NextResponse.json(policy);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  let patch;
  try { patch = validateCommandPolicyPatch(body); } catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 422 }); }

  const existing = await prisma.commandPolicy.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });

  const updated = await prisma.commandPolicy.update({ where: { id: params.id }, data: patch });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const existing = await prisma.commandPolicy.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });

  await prisma.commandPolicy.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
