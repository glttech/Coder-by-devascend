import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  checkLimit,
  getClientIp,
  isMutationMethod,
  MUTATION_LIMIT,
  READ_LIMIT,
  type Bucket,
} from '@/lib/rateLimiter';
import { log } from '@/lib/logger';

const GOVERNANCE_KEY = process.env.GOVERNANCE_API_KEY;

// Module-level store — persists across requests within the same server process.
const rlStore = new Map<string, Bucket>();

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const startMs = Date.now();

  log.info('request', { method, pathname, requestId });

  // Governance key guard — checked first, before rate limiting.
  if (GOVERNANCE_KEY) {
    const provided = request.headers.get('x-governance-key');
    if (provided !== GOVERNANCE_KEY) {
      const status = 401;
      log.info('response', { method, pathname, status, latencyMs: Date.now() - startMs, requestId });
      return NextResponse.json(
        { error: 'Unauthorized — x-governance-key header required' },
        { status, headers: { 'x-request-id': requestId } },
      );
    }
  }

  // Rate limiting — separate buckets for mutations (POST/PATCH) vs reads (GET).
  const ip = getClientIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
  );
  const mutation = isMutationMethod(request.method);
  const key = `${ip}:${mutation ? 'm' : 'r'}`;
  const limit = mutation ? MUTATION_LIMIT : READ_LIMIT;
  const { ok, retryAfter } = checkLimit(rlStore, key, limit);

  if (!ok) {
    const status = 429;
    log.info('response', { method, pathname, status, latencyMs: Date.now() - startMs, requestId });
    return NextResponse.json(
      { error: 'Too many requests — please slow down and retry' },
      {
        status,
        headers: { 'Retry-After': String(retryAfter), 'x-request-id': requestId },
      },
    );
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        'x-request-id': requestId,
      }),
    },
  });
  response.headers.set('x-request-id', requestId);

  log.info('response', { method, pathname, status: 200, latencyMs: Date.now() - startMs, requestId });

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
