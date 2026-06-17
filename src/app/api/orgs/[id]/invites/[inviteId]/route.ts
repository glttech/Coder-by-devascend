import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { revokeInvite } from '@/lib/invites';

export async function DELETE(_req: Request, { params }: { params: { id: string; inviteId: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  await revokeInvite(params.inviteId);
  return NextResponse.json({ ok: true });
}
