import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GOVERNANCE_KEY = process.env.GOVERNANCE_API_KEY;

export function middleware(request: NextRequest) {
  // If no key is configured, the guard is disabled (safe for local dev).
  if (!GOVERNANCE_KEY) return NextResponse.next();

  const provided = request.headers.get('x-governance-key');
  if (provided !== GOVERNANCE_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized — x-governance-key header required' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
