import type { AppSession } from './session.js';

export type RequiredRole = 'admin' | 'reviewer' | 'any';

/** Minimal shape required by the role guard — compatible with both AppSession and CurrentUser. */
type UserLike = { role: string };

/**
 * Role guard for API Route Handlers.
 *
 * Returns { ok: true, user } when the caller is authorised, or
 * { ok: false, status, message } with the appropriate HTTP status otherwise:
 *   - 401 when no session exists (unauthenticated)
 *   - 403 when the user's role does not satisfy the required role
 */
export function requireRole(
  user: AppSession | UserLike | null,
  role: RequiredRole,
): { ok: true; user: AppSession | UserLike } | { ok: false; status: 401 | 403; message: string } {
  if (user === null) {
    return { ok: false, status: 401, message: 'Unauthenticated' };
  }
  if (role === 'admin' && user.role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden — admin role required' };
  }
  if (role === 'reviewer' && user.role !== 'admin' && user.role !== 'reviewer') {
    return { ok: false, status: 403, message: 'Forbidden — reviewer role required' };
  }
  return { ok: true, user };
}

/** Returns true only when the user may approve tasks (admin only). */
export function canApprove(user: AppSession | UserLike | null): boolean {
  return user?.role === 'admin';
}

/** Returns true only when the user may manage projects (admin only). */
export function canManageProjects(user: AppSession | UserLike | null): boolean {
  return user?.role === 'admin';
}

/** Returns true when the user may view tasks (admin or reviewer). */
export function canViewTasks(user: AppSession | UserLike | null): boolean {
  return user?.role === 'admin' || user?.role === 'reviewer';
}
