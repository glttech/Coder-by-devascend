import type { AuthMode } from './session.js';

const PUBLIC_EXACT = new Set(['/login', '/register', '/favicon.ico']);
const PUBLIC_PREFIXES = ['/_next/', '/api/auth/'];

/** Returns true for paths that never require authentication. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export type AuthDecision =
  | { action: 'allow' }
  | { action: 'redirect_login'; next: string }
  | { action: 'reject_401' }
  | { action: 'reject_500' };

/**
 * Pure decision function: given auth context, return what the middleware should do.
 * Governance-key-required-in-disabled-mode is handled upstream — this function
 * receives `governanceKeyValid` which is true when no key is configured.
 */
export function resolveAuthDecision(opts: {
  mode: AuthMode;
  isPublic: boolean;
  isAuthenticated: boolean;
  governanceKeyValid: boolean;
  isApiPath: boolean;
  pathname: string;
}): AuthDecision {
  const { mode, isPublic, isAuthenticated, governanceKeyValid, isApiPath, pathname } = opts;

  if (isPublic) return { action: 'allow' };
  if (mode === 'disabled') return { action: 'allow' };
  if (mode === 'misconfigured') return { action: 'reject_500' };

  // mode === 'enforced'
  if (isApiPath && governanceKeyValid) return { action: 'allow' };
  if (isAuthenticated) return { action: 'allow' };
  if (isApiPath) return { action: 'reject_401' };
  return { action: 'redirect_login', next: pathname };
}
