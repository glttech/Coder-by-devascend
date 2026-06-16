import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export async function GET() {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });
  const webhooks = await prisma.webhook.findMany({ where: { orgId: 'org_default' }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const body = await request.json() as { url?: string; secret?: string; events?: string[] };
  if (!body.url?.startsWith('https://')) return NextResponse.json({ error: 'URL must start with https://' }, { status: 400 });
  if (!Array.isArray(body.events) || body.events.length === 0) return NextResponse.json({ error: 'Select at least one event' }, { status: 400 });

  const webhook = await prisma.webhook.create({
    data: { orgId: 'org_default', url: body.url, secret: body.secret, events: body.events },
  });
  return NextResponse.json({ webhook }, { status: 201 });
}
