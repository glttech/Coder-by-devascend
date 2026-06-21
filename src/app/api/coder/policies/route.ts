import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { validateCommandPolicyBody } from '@/lib/coder/commandPolicy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const orgId = req.nextUrl.searchParams.get('orgId') ?? 'org_default';
  const enabledParam = req.nextUrl.searchParams.get('enabled');
  const enabled = enabledParam === 'true' ? true : enabledParam === 'false' ? false : undefined;

  const policies = await prisma.commandPolicy.findMany({
    where: {
      orgId,
      ...(enabled !== undefined ? { enabled } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ policies });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  let data;
  try { data = validateCommandPolicyBody(body); } catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 422 }); }

  const orgId = (body as Record<string, unknown>).orgId as string | undefined ?? 'org_default';

  const existing = await prisma.commandPolicy.findUnique({ where: { orgId_name: { orgId, name: data.name } }, select: { id: true } });
  if (existing) return NextResponse.json({ error: `Policy "${data.name}" already exists` }, { status: 409 });

  const policy = await prisma.commandPolicy.create({ data: { ...data, orgId } });
  return NextResponse.json(policy, { status: 201 });
}
