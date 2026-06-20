export const DEFAULT_ORG_ID = 'org_default';

export function scoped(orgId: string) {
  return { orgId };
}

export async function ensureDefaultOrg() {
  // Import prisma and create org_default if it doesn't exist
  const { default: prisma } = await import('@/lib/prisma');
  const existing = await prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } });
  if (!existing) {
    await prisma.organization.create({
      data: { id: DEFAULT_ORG_ID, name: 'Default Organization', slug: 'default' }
    });
  }
}

/**
 * Resolves the orgId for a given userId via their primary Membership row.
 * Falls back to DEFAULT_ORG_ID for single-tenant deployments where
 * Membership may not be populated.
 */
export async function getOrgId(userId: string | undefined | null): Promise<string> {
  if (!userId) return DEFAULT_ORG_ID;
  const { default: prisma } = await import('@/lib/prisma');
  const membership = await prisma.membership.findFirst({
    where: { userId },
    select: { orgId: true },
  });
  return membership?.orgId ?? DEFAULT_ORG_ID;
}
