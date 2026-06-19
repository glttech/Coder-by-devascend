import crypto from 'crypto';
import prisma from '@/lib/prisma';

export type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.failed'
  | 'agent_run.completed'
  | 'agent_run.failed'
  | 'approval.granted'
  | 'approval.rejected'
  | 'instruction.approved'
  | 'instruction.blocked';

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_FAILURES_BEFORE_DISABLE = 5;

function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function buildWebhookPayload(event: WebhookEvent, data: unknown): string {
  return JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Delivers a single webhook — signs the payload, POSTs to url, returns true on success.
 * This function never throws; failures are returned as false.
 */
export async function deliverOne(
  url: string,
  secret: string | null | undefined,
  event: WebhookEvent,
  body: string,
  deliveryId: string,
): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Coder-by-DevAscend/1.0',
    'X-Coder-Event': event,
    'X-Coder-Delivery': deliveryId,
  };

  if (secret) {
    headers['X-Coder-Signature'] = signPayload(secret, body);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget outbound webhook delivery.
 *
 * Gated by WEBHOOKS_ENABLED=true env var — disabled by default to prevent
 * accidental external calls in dev/test environments.
 *
 * Finds all enabled webhooks subscribed to the given event, delivers to each,
 * and updates failureCount / lastTriggeredAt in the DB. Webhooks that exceed
 * MAX_FAILURES_BEFORE_DISABLE consecutive failures are auto-disabled.
 *
 * Never throws — all errors are caught and logged.
 */
export async function triggerWebhooks(event: WebhookEvent, data: unknown): Promise<void> {
  if (process.env.WEBHOOKS_ENABLED !== 'true') return;

  let webhooks: { id: string; url: string; secret: string | null; failureCount: number }[];
  try {
    webhooks = await prisma.webhook.findMany({
      where: { orgId: 'org_default', enabled: true, events: { has: event } },
      select: { id: true, url: true, secret: true, failureCount: true },
    });
  } catch (err) {
    console.error('[webhookDelivery] DB lookup failed', err);
    return;
  }

  if (webhooks.length === 0) return;

  const body = buildWebhookPayload(event, data);

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const deliveryId = crypto.randomUUID();
      const ok = await deliverOne(wh.url, wh.secret, event, body, deliveryId);

      try {
        if (ok) {
          await prisma.webhook.update({
            where: { id: wh.id },
            data: { lastTriggeredAt: new Date(), failureCount: 0 },
          });
        } else {
          const newCount = wh.failureCount + 1;
          await prisma.webhook.update({
            where: { id: wh.id },
            data: {
              failureCount: newCount,
              ...(newCount >= MAX_FAILURES_BEFORE_DISABLE ? { enabled: false } : {}),
            },
          });
          console.warn(
            `[webhookDelivery] Delivery failed for ${wh.id} (attempt ${newCount}/${MAX_FAILURES_BEFORE_DISABLE})`,
          );
        }
      } catch (err) {
        console.error('[webhookDelivery] DB update failed after delivery', err);
      }
    }),
  );
}
