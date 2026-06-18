import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { COMPETITORS, FEATURE_KEYS, VALID_STATUSES } from '@/lib/competitiveMatrix';

export const dynamic = 'force-dynamic';

/**
 * GET /api/competitor-features
 * Returns the full matrix as a flat list. Any authenticated user.
 */
export async function GET() {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const records = await prisma.competitorFeature.findMany({
    orderBy: [{ competitor: 'asc' }, { featureKey: 'asc' }],
  });

  return NextResponse.json({ records });
}

/**
 * POST /api/competitor-features
 * Upsert a single cell in the matrix. Admin only.
 * Body: { competitor, featureKey, status, notes? }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { competitor, featureKey, status, notes } = body as Record<string, unknown>;

  if (!COMPETITORS.includes(competitor as never)) {
    return NextResponse.json({ error: `Invalid competitor. Valid: ${COMPETITORS.join(', ')}` }, { status: 422 });
  }
  if (!FEATURE_KEYS.includes(featureKey as string)) {
    return NextResponse.json({ error: `Invalid featureKey. Valid: ${FEATURE_KEYS.join(', ')}` }, { status: 422 });
  }
  if (!VALID_STATUSES.includes(status as never)) {
    return NextResponse.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` }, { status: 422 });
  }

  const userId =
    ('userId' in auth.user ? auth.user.userId : undefined) ??
    ('id' in auth.user ? (auth.user as { id: string }).id : undefined) ??
    'system';

  const record = await prisma.competitorFeature.upsert({
    where: { competitor_featureKey: { competitor: String(competitor), featureKey: String(featureKey) } },
    create: {
      competitor: String(competitor),
      featureKey: String(featureKey),
      status: String(status),
      notes: notes ? String(notes) : null,
      updatedBy: userId,
    },
    update: {
      status: String(status),
      notes: notes !== undefined ? (notes ? String(notes) : null) : undefined,
      updatedBy: userId,
    },
  });

  await writeAudit({
    event: 'competitor_feature_updated',
    details: JSON.stringify({ competitor, featureKey, status }),
    userId,
  });

  return NextResponse.json(record);
}
