import { NextResponse } from 'next/server';
import { createShareLink } from '@/lib/shareLinks';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const { entityType, entityId, ttlDays } = await req.json();
  if (!entityType || !entityId) return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 });
  const raw = await createShareLink(entityType, entityId, user!.id, ttlDays);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/share/${raw}`;
  return NextResponse.json({ shareUrl });
}
