import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/lib/events/bus';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const channel = req.nextUrl.searchParams.get('channel') ?? 'default';

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keep-alive
      controller.enqueue(encoder.encode(': ping\n\n'));

      unsubscribe = subscribe(channel, (event) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          controller.close();
        }
      });

      // Keep-alive ping every 15s
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        unsubscribe?.();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
