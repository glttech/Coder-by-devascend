import { log } from './logger.js';

export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const hasExternalTracking =
      process.env.SENTRY_DSN || process.env.ERROR_TRACKING_DSN;

    if (hasExternalTracking) {
      // Lazily import Sentry if DSN is configured — avoids requiring the package
      // when not in use. If the import fails (package not installed), fall through
      // to log.error silently.
      void (async () => {
        try {
          // @ts-expect-error — optional dependency; may not be installed
          const Sentry = await import('@sentry/nextjs');
          Sentry.captureException(err, { extra: ctx });
        } catch {
          // Sentry package not installed — already logged below
        }
      })();
    }

    log.error('unhandled_exception', { message, ...ctx });
  } catch {
    // Never throw from error tracking
  }
}
