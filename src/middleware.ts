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

const GOVERNANCE_KEY = process.env.GOVERNANCE_API_KEY;

// Module-level store — persists across requests within the same server process.
const rlStore = new Map<string, Bucket>();

export function middleware(request: NextRequest) {
  // Governance key guard — checked first, before rate limiting.
  if (GOVERNANCE_KEY) {
    const provided = request.headers.get('x-governance-key');
    if (provided !== GOVERNANCE_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized — x-governance-key header required' },
        { status: 401 },
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
    return NextResponse.json(
      { error: 'Too many requests — please slow down and retry' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
