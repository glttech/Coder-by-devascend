import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  checkLimit,
  getClientIp,
  READ_LIMIT,
  type Bucket,
} from '@/lib/rateLimiter';

// Module-level rate-limit store for health endpoint (read bucket).
const rlStore = new Map<string, Bucket>();

// GET /api/health — no auth required.
// Returns service status, DB liveness, app version, and uptime.
export async function GET(request: Request) {
  // Rate limiting (read bucket)
  const req = request as unknown as { headers: { get: (k: string) => string | null } };
  const ip = getClientIp(
    req.headers.get('x-forwarded-for'),
    req.headers.get('x-real-ip'),
  );
  const key = `${ip}:r`;
  const { ok, retryAfter } = checkLimit(rlStore, key, READ_LIMIT);
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and retry' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  let dbStatus: 'ok' | 'error' = 'ok';
  let overallStatus: 'ok' | 'degraded' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
    overallStatus = 'degraded';
  }

  const body = {
    status: overallStatus,
    db: dbStatus,
    version: process.env.npm_package_version ?? 'unknown',
    uptimeSeconds: process.uptime(),
  };

  return NextResponse.json(body, { status: overallStatus === 'ok' ? 200 : 503 });
}
