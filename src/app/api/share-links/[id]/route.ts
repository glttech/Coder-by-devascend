import { NextResponse } from 'next/server';
import { revokeShareLink } from '@/lib/shareLinks';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  await revokeShareLink(params.id);
  return NextResponse.json({ ok: true });
}
