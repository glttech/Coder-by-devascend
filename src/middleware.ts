import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import {
  checkLimit,
  getClientIp,
  isMutationMethod,
  MUTATION_LIMIT,
  READ_LIMIT,
  type Bucket,
} from '@/lib/rateLimiter';
import { getAuthMode, getSessionOptions } from '@/lib/session';
import type { AppSession } from '@/lib/session';
import { isPublicPath, resolveAuthDecision } from '@/lib/authGuard';

const GOVERNANCE_KEY = process.env.GOVERNANCE_API_KEY;

// Module-level store — persists across requests within the same server process.
const rlStore = new Map<string, Bucket>();

async function readSession(request: NextRequest): Promise<boolean> {
  try {
    const opts = getSessionOptions();
    const cookieValue = request.cookies.get(opts.cookieName)?.value;
    if (!cookieValue) return false;
    const data = await unsealData<AppSession>(cookieValue, { password: opts.password });
    return Boolean((data as { userId?: unknown }).userId);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiPath = pathname.startsWith('/api/');
  const isPublic = isPublicPath(pathname);
  const mode = getAuthMode();

  // Governance key enforcement in disabled mode (preserve existing behaviour).
  // When auth is enforced, governance key is one of two valid credentials — handled below.
  if (mode === 'disabled' && isApiPath && GOVERNANCE_KEY) {
    const provided = request.headers.get('x-governance-key');
    if (provided !== GOVERNANCE_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized — x-governance-key header required' },
        { status: 401 },
      );
    }
  }

  // Governance key validity for enforced mode: true when key matches, or when no key is configured.
  const governanceKeyValid =
    !GOVERNANCE_KEY || request.headers.get('x-governance-key') === GOVERNANCE_KEY;

  // Read session only when auth is enforced and path is not public (avoids decrypt overhead).
  const isAuthenticated =
    mode === 'enforced' && !isPublic ? await readSession(request) : false;

  const decision = resolveAuthDecision({
    mode,
    isPublic,
    isAuthenticated,
    governanceKeyValid,
    isApiPath,
    pathname,
  });

  if (decision.action === 'redirect_login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', decision.next);
    return NextResponse.redirect(url);
  }

  if (decision.action === 'reject_401') {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  if (decision.action === 'reject_500') {
    return NextResponse.json(
      { error: 'Server auth configuration error. Contact the server admin.', code: 'MISCONFIGURED' },
      { status: 500 },
    );
  }

  // Rate limiting — only for API routes.
  if (isApiPath) {
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
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except Next.js static assets and images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
