import { NextResponse } from 'next/server';
import { createShareLink } from '@/lib/shareLinks';

export async function POST(req: Request) {
  const { entityType, entityId, ttlDays } = await req.json();
  if (!entityType || !entityId) return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 });
  const raw = await createShareLink(entityType, entityId, 'user', ttlDays);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/share/${raw}`;
  return NextResponse.json({ shareUrl });
}
