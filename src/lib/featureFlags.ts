/**
 * Feature flags — read from environment variables at call-time so they can be
 * changed without restarting the process in development.
 */
export function getFeatureFlags() {
  return {
    /** When true, the logger emits structured JSON lines to stdout. Default: true. */
    structuredLoggingEnabled: process.env.STRUCTURED_LOGGING !== 'false',
  };
}
