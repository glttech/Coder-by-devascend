import { getCurrentUser } from '@/lib/currentUser';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import prisma from '@/lib/prisma';
import WebhookManager from '@/components/WebhookManager';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const webhooks = await prisma.webhook.findMany({ where: { orgId: 'org_default' }, orderBy: { createdAt: 'desc' } });
  return (
    <div>
      <PageHeader title="Outbound Webhooks" subtitle="Send HTTP POST notifications to external services on app events" />
      <div className="section">
        <WebhookManager initialWebhooks={webhooks} />
      </div>
    </div>
  );
}
