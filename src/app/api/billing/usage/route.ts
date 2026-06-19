import { NextResponse } from 'next/server';
import { getUsageMetrics } from '@/lib/usage';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const metrics = await getUsageMetrics();
  return NextResponse.json({ metrics, generatedAt: new Date().toISOString() });
}
