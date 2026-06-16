import crypto from 'node:crypto';
import prisma from '@/lib/prisma';

export type WebhookEventName =
  | 'task.created'
  | 'task.status_changed'
  | 'run.completed'
  | 'approval.requested'
  | 'approval.decided';

export interface WebhookPayload {
  event: WebhookEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function dispatchWebhook(orgId: string, event: WebhookEventName, data: Record<string, unknown>): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { orgId, enabled: true, events: { has: event } },
  });
  if (webhooks.length === 0) return;

  const payload: WebhookPayload = { event, timestamp: new Date().toISOString(), data };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Id': wh.id,
      };
      if (wh.secret) {
        headers['X-Webhook-Signature'] = signPayload(wh.secret, body);
      }
      try {
        const res = await fetch(wh.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) });
        await prisma.webhook.update({
          where: { id: wh.id },
          data: {
            lastTriggeredAt: new Date(),
            failureCount: res.ok ? 0 : { increment: 1 },
          },
        });
      } catch {
        await prisma.webhook.update({
          where: { id: wh.id },
          data: { failureCount: { increment: 1 } },
        });
      }
    })
  );
}
