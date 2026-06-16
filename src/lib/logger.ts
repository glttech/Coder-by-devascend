import { getRequestId } from './requestContext.js';

const REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'secret',
  'cookie',
  'authorization',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = REDACT_KEYS.has(key) ? '[REDACTED]' : value;
  }
  return result;
}

function emit(level: 'info' | 'warn' | 'error', event: string, fields?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  const requestId = getRequestId();
  if (requestId !== undefined) {
    entry.requestId = requestId;
  }
  if (fields && Object.keys(fields).length > 0) {
    Object.assign(entry, redact(fields));
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>): void => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>): void => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>): void => emit('error', event, fields),
};
