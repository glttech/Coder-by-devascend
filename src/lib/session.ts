import type { SessionOptions } from 'iron-session';

export interface AppSession {
  userId: 'admin';
  username: string;
  loginAt: string;
}

export type AuthMode = 'disabled' | 'enforced' | 'misconfigured';

type Env = Record<string, string | undefined>;

/**
 * Returns the current auth mode based on env vars.
 * - 'disabled'      — neither ADMIN_USERNAME nor ADMIN_PASSWORD_HASH is set (local dev)
 * - 'enforced'      — both are set; login required
 * - 'misconfigured' — one is set without the other (unsafe; treated as server error)
 */
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

/** Minimum SESSION_SECRET length required by iron-session (bytes). */
export const SESSION_SECRET_MIN_LENGTH = 32;

export type ConfigValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validates auth-related env config without exposing any secret values.
 * Returns { ok: true } when config is valid, or { ok: false, error: '...' } otherwise.
 */
export function validateAuthConfig(env: Env = process.env): ConfigValidationResult {
  const mode = getAuthMode(env);

  if (mode === 'misconfigured') {
    const hasUsername = Boolean(env.ADMIN_USERNAME);
    if (hasUsername) {
      return { ok: false, error: 'ADMIN_USERNAME is set but ADMIN_PASSWORD_HASH is missing' };
    }
    return { ok: false, error: 'ADMIN_PASSWORD_HASH is set but ADMIN_USERNAME is missing' };
  }

  if (mode === 'enforced') {
    const secret = env.SESSION_SECRET;
    if (!secret) {
      return { ok: false, error: 'SESSION_SECRET must be set when auth is enforced' };
    }
    if (secret.length < SESSION_SECRET_MIN_LENGTH) {
      return {
        ok: false,
        error: `SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`,
      };
    }
  }

  return { ok: true };
}

/**
 * Parse SESSION_MAX_AGE_HOURS. Returns the parsed hours (positive integer),
 * or 24 as default. Also returns a warning string when the raw value is invalid
 * so callers can log it without guessing why the default was used.
 */
export function parseSessionMaxAge(raw: string | undefined): { hours: number; warning?: string } {
  if (!raw) return { hours: 24 };
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return {
      hours: 24,
      warning: `SESSION_MAX_AGE_HOURS is not a valid positive integer; defaulting to 24 hours`,
    };
  }
  return { hours: parsed };
}

export function getSessionOptions(env: Env = process.env): SessionOptions {
  const { hours, warning } = parseSessionMaxAge(env.SESSION_MAX_AGE_HOURS);
  if (warning && typeof process !== 'undefined') {
    console.warn(`[auth] ${warning}`);
  }
  const ttl = hours * 60 * 60;

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
    if (secret.length < SESSION_SECRET_MIN_LENGTH) {
      throw new Error(
        `SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`,
      );
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
