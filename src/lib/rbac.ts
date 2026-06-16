/**
 * RBAC helpers for route handlers.
 *
 * The app currently has a single-admin model: if auth is disabled the request
 * is always permitted; if auth is enabled the user must be logged in.
 *
 * `requireRole` accepts a role string for forward-compatibility but currently
 * treats any authenticated session (role 'any' or 'admin') as sufficient.
 */

export type RoleCheckResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Returns { ok: true } when the caller has the required role.
 *
 * @param user  - result from getCurrentUser(); null means unauthenticated
 * @param role  - 'any' | 'admin' | 'reviewer' | 'viewer'
 */
export function requireRole(
  user: { id: string; role?: string } | null,
  role: string,
): RoleCheckResult {
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  // Single-admin model: authenticated user satisfies any role requirement.
  // When multi-role support lands, extend this comparison.
  if (role === 'admin' && user.role && user.role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden' };
  }
  return { ok: true };
}
