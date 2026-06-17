import crypto from 'crypto';
import prisma from '@/lib/prisma';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInviteToken(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

export async function createInvite(orgId: string, email: string, role: string, invitedBy: string) {
  const existing = await prisma.invitation.findFirst({ where: { orgId, email, status: 'pending' } });
  if (existing) {
    await prisma.invitation.update({ where: { id: existing.id }, data: { status: 'revoked' } });
  }
  const { raw, hashed } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.invitation.create({ data: { orgId, email, role, token: hashed, invitedBy, expiresAt } });
  return raw; // caller puts in link
}

export async function verifyInviteToken(raw: string) {
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const invite = await prisma.invitation.findUnique({ where: { token: hashed } });
  if (!invite) return null;
  if (invite.status !== 'pending') return null;
  if (invite.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invite.id }, data: { status: 'expired' } });
    return null;
  }
  return invite;
}

export async function acceptInvite(inviteId: string) {
  await prisma.invitation.update({ where: { id: inviteId }, data: { status: 'accepted' } });
}

export async function revokeInvite(inviteId: string) {
  await prisma.invitation.update({ where: { id: inviteId }, data: { status: 'revoked' } });
}
