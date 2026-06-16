export const DEFAULT_ORG_ID = 'org_default';

export function scoped(orgId: string) {
  return { orgId };
}

export async function ensureDefaultOrg() {
  // Import prisma and create org_default if it doesn't exist
  const { prisma } = await import('@/lib/prisma');
  const existing = await prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } });
  if (!existing) {
    await prisma.organization.create({
      data: { id: DEFAULT_ORG_ID, name: 'Default Organization', slug: 'default' }
    });
  }
}
