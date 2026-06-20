import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

const VALID_WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.completed', 'task.failed',
  'agent_run.completed', 'agent_run.failed',
  'approval.granted', 'approval.rejected',
  'instruction.approved', 'instruction.blocked',
] as const;
const WEBHOOK_URL_MAX = 2048;
const WEBHOOK_SECRET_MAX = 256;

export async function GET() {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const webhooks = await prisma.webhook.findMany({
    where: { orgId: 'org_default' },
    select: { id: true, url: true, events: true, enabled: true, failureCount: true, lastTriggeredAt: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const body = await request.json() as { url?: string; secret?: string; events?: string[] };
  const errs: string[] = [];
  if (!body.url?.startsWith('https://')) errs.push('URL must start with https://');
  if (body.url && body.url.length > WEBHOOK_URL_MAX) errs.push(`URL must be ${WEBHOOK_URL_MAX} characters or fewer`);
  if (body.secret !== undefined && body.secret !== null && body.secret.length > WEBHOOK_SECRET_MAX) errs.push(`secret must be ${WEBHOOK_SECRET_MAX} characters or fewer`);
  if (!Array.isArray(body.events) || body.events.length === 0) {
    errs.push('Select at least one event');
  } else {
    const invalid = body.events.filter((e) => !(VALID_WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (invalid.length > 0) errs.push(`Unknown event types: ${invalid.join(', ')}`);
  }
  if (errs.length > 0) return NextResponse.json({ error: errs.join('; ') }, { status: 400 });

  const webhook = await prisma.webhook.create({
    data: { orgId: 'org_default', url: body.url!, secret: body.secret, events: body.events! },
  });
  return NextResponse.json({ webhook }, { status: 201 });
}
