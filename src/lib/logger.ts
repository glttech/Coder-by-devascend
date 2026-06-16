/**
 * Structured JSON logger.
 *
 * Each log line is a JSON object with: { ts, level, event, requestId, ...fields }
 * Sensitive field values are redacted before serialization.
 */

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'cookie',
  'authorization',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function write(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const { requestId, ...rest } = fields;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(requestId !== undefined ? { requestId } : {}),
    ...redact(rest),
  };

  const serialized = JSON.stringify(line);

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const log = {
  info(event: string, fields: Record<string, unknown> = {}): void {
    write('info', event, fields);
  },
  warn(event: string, fields: Record<string, unknown> = {}): void {
    write('warn', event, fields);
  },
  error(event: string, fields: Record<string, unknown> = {}): void {
    write('error', event, fields);
  },
};
