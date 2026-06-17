import { NextResponse } from 'next/server';
import { revokeShareLink } from '@/lib/shareLinks';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await revokeShareLink(params.id);
  return NextResponse.json({ ok: true });
}
