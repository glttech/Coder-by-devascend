import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

// GET /api/orgs — list organizations the current user belongs to
export async function GET() {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const memberships = await prisma.membership.findMany({
    where: { userId: check.user.userId },
    include: { org: true },
  });

  return NextResponse.json({ orgs: memberships.map(m => ({ ...m.org, role: m.role })) });
}

// POST /api/orgs — create a new organization (the caller becomes owner)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const body = await request.json() as { name?: string; slug?: string };
  if (!body.name || !body.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]{2,40}$/.test(body.slug)) {
    return NextResponse.json({ error: 'slug must be 2-40 lowercase letters, numbers, or hyphens' }, { status: 400 });
  }

  const existing = await prisma.organization.findUnique({ where: { slug: body.slug } });
  if (existing) return NextResponse.json({ error: 'slug already taken' }, { status: 409 });

  const org = await prisma.organization.create({
    data: {
      name: body.name,
      slug: body.slug,
      memberships: {
        create: { userId: check.user.userId, role: 'owner' },
      },
    },
  });

  return NextResponse.json({ org }, { status: 201 });
}
