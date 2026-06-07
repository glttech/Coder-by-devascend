import type { SessionOptions } from 'iron-session';

export interface AppSession {
  userId: 'admin';
  username: string;
  loginAt: string;
}

export type AuthMode = 'disabled' | 'enforced' | 'misconfigured';

/**
 * Returns the current auth mode based on env vars.
 * - 'disabled'      — neither ADMIN_USERNAME nor ADMIN_PASSWORD_HASH is set (local dev)
 * - 'enforced'      — both are set; login required
 * - 'misconfigured' — one is set without the other (unsafe; treated as server error)
 */
type Env = Record<string, string | undefined>;

export function getAuthMode(env: Env = process.env): AuthMode {
  const hasUsername = Boolean(env.ADMIN_USERNAME);
  const hasHash = Boolean(env.ADMIN_PASSWORD_HASH);
  if (!hasUsername && !hasHash) return 'disabled';
  if (hasUsername && hasHash) return 'enforced';
  return 'misconfigured';
}

export function isAuthEnabled(env: Env = process.env): boolean {
  return getAuthMode(env) === 'enforced';
}

export function getSessionOptions(env: Env = process.env): SessionOptions {
  const maxAgeHours = parseInt(env.SESSION_MAX_AGE_HOURS ?? '24', 10);
  const ttl = (isNaN(maxAgeHours) ? 24 : maxAgeHours) * 60 * 60;

  const mode = getAuthMode(env);
  let password: string;
  if (mode === 'disabled') {
    // Auth is disabled; session is never actually used, but iron-session requires a password.
    password = 'dev-only-placeholder-never-use-in-production-must-be-32-chars-x';
  } else {
    const secret = env.SESSION_SECRET;
    if (!secret) {
      throw new Error('SESSION_SECRET must be set when auth is enabled');
    }
    password = secret;
  }

  return {
    password,
    cookieName: '__session',
    ttl,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  };
}
