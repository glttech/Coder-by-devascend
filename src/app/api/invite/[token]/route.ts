import { NextResponse } from 'next/server';
import { verifyInviteToken, acceptInvite } from '@/lib/invites';
import { getCurrentUser } from '@/lib/currentUser';
import { writeAudit } from '@/lib/audit';

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const invite = await verifyInviteToken(params.token);
  if (!invite) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 410 });
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ redirect: `/register?invite=${params.token}` }, { status: 200 });
  }
  await acceptInvite(invite.id);
  await writeAudit({ event: 'invite.accepted', details: `${user.id} accepted invite to org ${invite.orgId}` });
  return NextResponse.json({ ok: true });
}
