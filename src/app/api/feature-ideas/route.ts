import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_DECISIONS = new Set(['build', 'skip', 'defer', 'under_review']);
const VALID_RELEVANCE = new Set(['low', 'medium', 'high', 'critical']);
const VALID_RISK = new Set(['low', 'medium', 'high']);

/**
 * GET /api/feature-ideas
 * List all feature ideas, newest first.
 * Query: decision, relevance, vendor, limit, offset
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const decision = searchParams.get('decision') ?? undefined;
  const relevance = searchParams.get('relevance') ?? undefined;
  const vendor = searchParams.get('vendor') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

  const where: Record<string, unknown> = {};
  if (decision && VALID_DECISIONS.has(decision)) where['decision'] = decision;
  if (relevance && VALID_RELEVANCE.has(relevance)) where['relevance'] = relevance;
  if (vendor) where['vendor'] = { contains: vendor, mode: 'insensitive' };

  const [ideas, total] = await Promise.all([
    prisma.featureIdea.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.featureIdea.count({ where }),
  ]);

  return NextResponse.json({ ideas, total, limit, offset });
}

/**
 * POST /api/feature-ideas
 * Create a new feature idea (admin only).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 422 });
  }

  const {
    title, description, problemSolved, vendor, sourceUrl, sourceType,
    relevance, riskLevel, coderHasFeature, coderNotes,
  } = body;

  if (relevance && !VALID_RELEVANCE.has(relevance)) {
    return NextResponse.json({ error: `relevance must be one of: ${[...VALID_RELEVANCE].join(', ')}` }, { status: 422 });
  }
  if (riskLevel && !VALID_RISK.has(riskLevel)) {
    return NextResponse.json({ error: `riskLevel must be one of: ${[...VALID_RISK].join(', ')}` }, { status: 422 });
  }

  const userId =
    ('userId' in auth.user ? auth.user.userId : undefined) ??
    ('id' in auth.user ? (auth.user as { id: string }).id : undefined) ??
    'system';

  const idea = await prisma.featureIdea.create({
    data: {
      title: String(title).trim(),
      description: description ? String(description) : undefined,
      problemSolved: problemSolved ? String(problemSolved) : undefined,
      vendor: vendor ? String(vendor) : undefined,
      sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
      sourceType: sourceType ? String(sourceType) : 'manual',
      relevance: relevance ?? 'medium',
      riskLevel: riskLevel ?? 'medium',
      coderHasFeature: Boolean(coderHasFeature),
      coderNotes: coderNotes ? String(coderNotes) : undefined,
      createdBy: userId,
    },
  });

  await writeAudit({
    event: 'feature_idea_created',
    details: JSON.stringify({ ideaId: idea.id, title: idea.title, vendor: idea.vendor }),
    userId,
  });

  return NextResponse.json(idea, { status: 201 });
}
