/**
 * Lightweight error tracking shim.
 *
 * In production: sends to an external service when ERROR_TRACKING_DSN is set.
 * In development (or when DSN is absent): logs via the structured logger.
 */

import { log } from './logger.js';

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { raw: String(err) };
}

/**
 * Capture an exception and optionally associate extra context with it.
 *
 * No-op in production unless `ERROR_TRACKING_DSN` is configured.
 */
export function captureException(
  err: unknown,
  ctx: Record<string, unknown> = {},
): void {
  const dsn = process.env.ERROR_TRACKING_DSN;

  if (!dsn) {
    // Only log in non-production or when there is no DSN configured.
    if (process.env.NODE_ENV !== 'production') {
      log.error('captureException', { error: serializeError(err), ...ctx });
    }
    return;
  }

  // Production path: forward to external service.
  // Replace this block with the SDK call for the chosen provider (e.g. Sentry).
  log.error('captureException', { error: serializeError(err), dsn: '[configured]', ...ctx });
}
