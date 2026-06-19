import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeStateVersion } from '@/lib/stateVersion';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/instructions/[id]/stale?stateVersion=<hash>
// Returns { stale: boolean, currentStateVersion: string | null }.
// No mutation — pure read. Used by external callers to detect if a cached
// instruction is out of date without fetching the full record.
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientVersion = searchParams.get('stateVersion');

  if (!clientVersion || clientVersion.trim().length === 0) {
    return NextResponse.json(
      { error: 'stateVersion query parameter is required' },
      { status: 422 },
    );
  }

  try {
    const instruction = await prisma.instruction.findUnique({
      where: { id: params.id },
    });

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    // If the row was created before stateVersion was introduced, compute it now
    // (read-only — does not persist the computed value).
    const currentStateVersion =
      instruction.stateVersion ?? computeStateVersion(instruction);

    const stale = currentStateVersion !== clientVersion.trim();

    return NextResponse.json({ stale, currentStateVersion });
  } catch (err) {
    console.error('[instructions/stale GET]', err);
    return NextResponse.json({ error: 'Failed to check staleness' }, { status: 500 });
  }
}
