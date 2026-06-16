import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import ApiKeyManager from '@/components/ApiKeyManager';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const rawKeys = await prisma.apiKey.findMany({
    where: { orgId: 'org_default', revokedAt: null },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Serialize Date objects for the client component (dates arrive as strings over JSON)
  const keys = rawKeys.map(k => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader title="API Keys" subtitle="Manage programmatic access credentials" />
      <div className="section">
        <Card>
          <CardHeader
            title="API Keys"
            subtitle="Keys grant programmatic access. The raw key is shown only once on creation."
          />
          <ApiKeyManager initialKeys={keys} />
        </Card>
      </div>
    </div>
  );
}
