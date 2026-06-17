/**
 * GET /api/agent-roles — list available agent roles.
 *
 * Returns all 7 built-in governance roles. Auth: any authenticated user.
 * Custom org-specific roles are not yet supported (Phase 1.2).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { BUILT_IN_ROLES } from '@/lib/agents/roles';

export async function GET() {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  return NextResponse.json({ roles: BUILT_IN_ROLES });
}
