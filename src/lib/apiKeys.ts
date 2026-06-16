import crypto from 'crypto';
import prisma from '@/lib/prisma';

export const VALID_SCOPES = [
  'tasks:read',
  'tasks:write',
  'projects:read',
  'projects:write',
  'runs:read',
  'evidence:read',
] as const;

export type ApiScope = (typeof VALID_SCOPES)[number];

export function generateRawKey(): string {
  return 'cda__' + crypto.randomBytes(32).toString('base64url');
}

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

interface CreateApiKeyInput {
  orgId: string;
  name: string;
  scopes: string[];
  createdBy: string;
  expiresAt?: Date;
}

export async function createApiKey(input: CreateApiKeyInput) {
  const invalidScopes = input.scopes.filter(s => !VALID_SCOPES.includes(s as ApiScope));
  if (invalidScopes.length > 0) throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);

  const raw = generateRawKey();
  const prefix = raw.slice(0, 12);
  const keyHash = hashKey(raw);

  await prisma.apiKey.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      prefix,
      keyHash,
      scopes: input.scopes,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt,
    },
  });

  return { rawKey: raw, prefix };
}

export async function authenticateApiKey(req: Request): Promise<{ orgId: string; scopes: string[] } | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  if (!raw.startsWith('cda__')) return null;

  const keyHash = hashKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Update lastUsedAt asynchronously — don't block the request
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { orgId: key.orgId, scopes: key.scopes };
}
