import { NextResponse } from 'next/server';
import { getUsageMetrics } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const metrics = await getUsageMetrics();
  return NextResponse.json({ metrics, generatedAt: new Date().toISOString() });
}
