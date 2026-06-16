import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

const VALID_EVENTS = ['task.created', 'task.status_changed', 'run.completed', 'approval.requested', 'approval.decided'];

export async function GET() {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const webhooks = await prisma.webhook.findMany({ where: { orgId: 'org_default' }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ webhooks, validEvents: VALID_EVENTS });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const body = await request.json() as { name?: string; url?: string; events?: string[]; secret?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.url?.startsWith('https://')) return NextResponse.json({ error: 'url must be https' }, { status: 400 });
  if (!Array.isArray(body.events) || body.events.length === 0) return NextResponse.json({ error: 'at least one event required' }, { status: 400 });
  const invalid = body.events.filter(e => !VALID_EVENTS.includes(e));
  if (invalid.length > 0) return NextResponse.json({ error: `unknown events: ${invalid.join(', ')}` }, { status: 400 });
  const wh = await prisma.webhook.create({
    data: { orgId: 'org_default', name: body.name.trim(), url: body.url, events: body.events, secret: body.secret?.trim() || null },
  });
  return NextResponse.json(wh, { status: 201 });
}
