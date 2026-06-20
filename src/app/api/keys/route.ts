import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { createApiKey, VALID_SCOPES } from '@/lib/apiKeys';

// GET /api/keys — list API keys for current org (shows prefix only, never raw key)
export async function GET() {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const keys = await prisma.apiKey.findMany({
    where: { orgId: 'org_default', revokedAt: null },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ keys, validScopes: VALID_SCOPES });
}

// POST /api/keys — create a new API key (raw key returned ONCE)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const body = await request.json() as { name?: string; scopes?: string[]; expiresAt?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return NextResponse.json({ error: 'at least one scope is required' }, { status: 400 });
  }

  // Validate scopes before calling createApiKey so unknown errors aren't leaked
  const invalidScopes = body.scopes.filter(s => !VALID_SCOPES.includes(s as (typeof VALID_SCOPES)[number]));
  if (invalidScopes.length > 0) {
    return NextResponse.json({ error: `Invalid scopes: ${invalidScopes.join(', ')}` }, { status: 400 });
  }

  try {
    const result = await createApiKey({
      orgId: 'org_default',
      name: body.name.trim(),
      scopes: body.scopes,
      createdBy: user!.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[keys POST]', err);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
