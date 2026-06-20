import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { checkLimit, getClientIp, Bucket } from '@/lib/rateLimiter';
import { getOrgId } from '@/lib/orgScope';
import { validateRawPayload, sanitizeRawPayload } from '@/lib/soc/rawPayload';

const _alertCreateBuckets = new Map<string, Bucket>();

const VALID_SOURCES = ['wazuh', 'sentry', 'manual'] as const;
const VALID_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
const VALID_STATUSES = ['new', 'triaging', 'escalated', 'closed'] as const;

// GET /api/soc/alerts — paginated list of security alerts.
// Query params: limit (default 50, max 200), cursor (<createdAt ISO>|<id>), status, severity, source
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const orgId = await getOrgId(user?.userId);
  const { searchParams } = new URL(request.url);

  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);

  // Compound cursor: "<createdAt ISO>|<id>" ensures stable ordering when
  // multiple rows share the same createdAt timestamp.
  const cursorParam = searchParams.get('cursor');
  let cursorFilter: Record<string, unknown> = {};
  if (cursorParam) {
    const pipeIdx = cursorParam.lastIndexOf('|');
    if (pipeIdx > 0) {
      const cursorDate = new Date(cursorParam.slice(0, pipeIdx));
      const cursorId = cursorParam.slice(pipeIdx + 1);
      if (!isNaN(cursorDate.getTime()) && cursorId) {
        cursorFilter = {
          OR: [
            { createdAt: { lt: cursorDate } },
            { AND: [{ createdAt: cursorDate }, { id: { lt: cursorId } }] },
          ],
        };
      }
    }
  }

  // Multi-value filters (comma-separated)
  const statusParam = searchParams.get('status');
  const statusFilter = statusParam
    ? statusParam.split(',').filter((s) => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
    : undefined;

  const severityParam = searchParams.get('severity');
  const severityFilter = severityParam
    ? severityParam.split(',').filter((s) => VALID_SEVERITIES.includes(s as typeof VALID_SEVERITIES[number]))
    : undefined;

  const sourceParam = searchParams.get('source');
  const sourceFilter = sourceParam
    ? sourceParam.split(',').filter((s) => VALID_SOURCES.includes(s as typeof VALID_SOURCES[number]))
    : undefined;

  try {
    const alerts = await prisma.securityAlert.findMany({
      where: {
        orgId,
        archivedAt: null,
        ...(statusFilter?.length ? { status: { in: statusFilter } } : {}),
        ...(severityFilter?.length ? { severity: { in: severityFilter } } : {}),
        ...(sourceFilter?.length ? { source: { in: sourceFilter } } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const nextCursor =
      alerts.length === limit
        ? `${alerts[alerts.length - 1].createdAt.toISOString()}|${alerts[alerts.length - 1].id}`
        : null;

    return NextResponse.json({ alerts, nextCursor });
  } catch (err) {
    console.error('[soc/alerts GET]', err);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// POST /api/soc/alerts — create a single security alert manually. Requires admin role.
export async function POST(request: Request) {
  const ip = getClientIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
  );
  const rl = checkLimit(_alertCreateBuckets, ip, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — try again shortly' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    source,
    sourceId,
    sourceRef,
    title,
    description,
    ruleId,
    mitreTactic,
    mitreTechniqueId,
    mitreTechnique,
    severity,
    alertedAt,
    rawPayload,
  } = body;

  const errors: string[] = [];

  if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
    errors.push('title is required');
  } else if ((title as string).length > 500) {
    errors.push('title must be 500 characters or fewer');
  }

  if (!source || !VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (description !== undefined && typeof description === 'string' && description.length > 10_000) {
    errors.push('description must be 10,000 characters or fewer');
  }

  if (alertedAt !== undefined && alertedAt !== null) {
    const parsed = new Date(alertedAt as string);
    if (isNaN(parsed.getTime())) {
      errors.push('alertedAt must be a valid ISO date string');
    }
  }

  errors.push(...validateRawPayload(rawPayload));

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  const orgId = await getOrgId(user?.userId);

  try {
    const alert = await prisma.securityAlert.create({
      data: {
        orgId,
        source: source as string,
        sourceId: typeof sourceId === 'string' ? sourceId : undefined,
        sourceRef: typeof sourceRef === 'string' ? sourceRef : undefined,
        title: (title as string).trim(),
        description: typeof description === 'string' ? description.trim() : undefined,
        ruleId: typeof ruleId === 'string' ? ruleId : undefined,
        mitreTactic: typeof mitreTactic === 'string' ? mitreTactic : undefined,
        mitreTechniqueId: typeof mitreTechniqueId === 'string' ? mitreTechniqueId : undefined,
        mitreTechnique: typeof mitreTechnique === 'string' ? mitreTechnique : undefined,
        severity: (severity as string) ?? 'medium',
        alertedAt: alertedAt ? new Date(alertedAt as string) : undefined,
        rawPayload: (sanitizeRawPayload(rawPayload) as Prisma.InputJsonValue) ?? undefined,
      },
    });

    await writeAudit({
      event: 'soc_alert_created',
      userId: user?.userId ?? null,
      details: JSON.stringify({
        alertId: alert.id,
        source: alert.source,
        severity: alert.severity,
        at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    console.error('[soc/alerts POST]', err);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
