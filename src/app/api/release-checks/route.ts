import { NextResponse } from 'next/server';
import { runReadinessChecks } from '@/lib/releaseChecks';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/release-checks — runs the release readiness checks and returns a structured report.
// Auth: admin only. Returns 401 if unauthenticated, 403 if non-admin.
// When auth is disabled (local dev), the check passes through.
export async function GET() {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');

  // If auth is enforced and user is not an admin, reject.
  // When auth is disabled, getCurrentUser returns null and requireRole returns 401,
  // but we want to allow unauthenticated access in that case.
  // We detect auth-disabled by checking if the overall check would pass regardless.
  if (!roleCheck.ok) {
    // Check if auth is actually disabled (dev mode)
    const { isAuthEnabled } = await import('@/lib/session');
    if (isAuthEnabled()) {
      return NextResponse.json(
        { error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: roleCheck.status },
      );
    }
  }

  try {
    const report = await runReadinessChecks();
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[release-checks] Error running readiness checks:', err);
    return NextResponse.json({ error: 'Failed to run readiness checks' }, { status: 500 });
  }
}
