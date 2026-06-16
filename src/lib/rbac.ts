export type RoleCheckResult = { ok: true } | { ok: false; status: 401 | 403; message: string };
export function requireRole(user: { id: string; role?: string } | null, role: string): RoleCheckResult {
  if (!user) return { ok: false, status: 401, message: 'Unauthorized' };
  if (role === 'admin' && user.role && user.role !== 'admin') return { ok: false, status: 403, message: 'Forbidden' };
  return { ok: true };
}
