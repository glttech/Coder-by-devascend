import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAuthEnabled } from '@/lib/session';
import { seedDemo } from '../../../../../prisma/seed-demo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demo/reset
 *
 * Re-seeds the database with demo data. Only available outside of production.
 * Requires admin authentication when auth is enforced.
 *
 * Returns: { ok: true } on success.
 */
export async function POST(): Promise<NextResponse> {
  // Only allow in non-production environments.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Demo reset is not available in production.' },
      { status: 403 },
    );
  }

  // Require admin auth when auth is enforced.
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });
    }
  }

  try {
    await seedDemo(prisma);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Seed failed: ${message}` }, { status: 500 });
  }
}
