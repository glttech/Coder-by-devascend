import prisma from '@/lib/prisma';

export const DEFAULT_ORG_ID = 'org_default';
export const DEFAULT_ORG_SLUG = 'default';

/**
 * Ensure the default organization exists (idempotent — safe to call on startup).
 */
export async function ensureDefaultOrg(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: 'Default Organization',
      slug: DEFAULT_ORG_SLUG,
      plan: 'free',
    },
  });
}

/**
 * Returns a Prisma `where` fragment scoping a query to an org.
 * Use like: prisma.project.findMany({ where: { ...orgWhere(orgId) } })
 */
export function orgWhere(orgId: string): { orgId: string } {
  return { orgId };
}

/**
 * Get the active org ID from a session (falls back to default).
 */
export function getActiveOrgId(session: { orgId?: string } | null): string {
  return session?.orgId ?? DEFAULT_ORG_ID;
}
