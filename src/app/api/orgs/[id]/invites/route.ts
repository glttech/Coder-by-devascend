import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { createInvite } from '@/lib/invites';
import { writeAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });
  const invites = await prisma.invitation.findMany({
    where: { orgId: params.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 });
  const validRoles = ['admin', 'reviewer', 'viewer'];
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  const rawToken = await createInvite(params.id, email, role, user?.id ?? 'system');
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${rawToken}`;
  await writeAudit({ event: 'invite.created', details: `Invited ${email} as ${role}` });
  return NextResponse.json({ inviteUrl });
}
