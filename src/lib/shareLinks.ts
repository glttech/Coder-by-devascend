import crypto from 'crypto';
import prisma from '@/lib/prisma';

export function generateShareToken(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(24).toString('base64url');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

export async function createShareLink(entityType: string, entityId: string, createdBy: string, ttlDays?: number) {
  const { raw, hashed } = generateShareToken();
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 86400_000) : null;
  await prisma.shareLink.create({ data: { entityType, entityId, token: hashed, expiresAt, createdBy } });
  return raw;
}

export async function verifyShareToken(raw: string) {
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const link = await prisma.shareLink.findUnique({ where: { token: hashed } });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  // Increment view count async
  prisma.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return link;
}

export async function revokeShareLink(id: string) {
  await prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
}
