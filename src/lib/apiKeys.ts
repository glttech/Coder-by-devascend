import crypto from 'node:crypto';
import prisma from '@/lib/prisma';

export const VALID_SCOPES = [
  'tasks:read',
  'tasks:write',
  'projects:read',
  'projects:write',
  'runs:read',
  'evidence:read',
] as const;

export type ApiKeyScope = typeof VALID_SCOPES[number];

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function generateRawKey(orgSlug: string): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `cda_${orgSlug}_${random}`;
}

export interface CreateApiKeyInput {
  orgId: string;
  name: string;
  scopes: string[];
  createdBy: string;
  expiresAt?: Date;
}

export interface CreateApiKeyResult {
  rawKey: string; // shown ONCE, never stored
  apiKey: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    createdAt: Date;
    expiresAt: Date | null;
  };
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  // Validate scopes
  const invalidScopes = input.scopes.filter(s => !VALID_SCOPES.includes(s as ApiKeyScope));
  if (invalidScopes.length > 0) throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);

  const rawKey = generateRawKey('org'); // use generic slug prefix
  const prefix = rawKey.slice(0, 16); // first 16 chars shown in UI
  const hashedKey = hashKey(rawKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      prefix,
      hashedKey,
      scopes: input.scopes,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { rawKey, apiKey };
}

export async function authenticateApiKey(rawKey: string): Promise<{
  ok: true;
  keyId: string;
  orgId: string;
  scopes: string[];
} | { ok: false; status: 401 | 403; error: string }> {
  if (!rawKey.startsWith('cda_')) return { ok: false, status: 401, error: 'Invalid key format' };

  const hashed = hashKey(rawKey);
  const key = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });

  if (!key) return { ok: false, status: 401, error: 'Invalid API key' };
  if (key.revokedAt) return { ok: false, status: 401, error: 'API key has been revoked' };
  if (key.expiresAt && key.expiresAt < new Date()) return { ok: false, status: 401, error: 'API key has expired' };

  // Update lastUsedAt asynchronously (don't await — non-blocking)
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { ok: true, keyId: key.id, orgId: key.orgId, scopes: key.scopes };
}

export function hasScope(scopes: string[], required: ApiKeyScope): boolean {
  return scopes.includes(required);
}
