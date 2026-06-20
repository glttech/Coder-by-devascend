export const RAW_PAYLOAD_MAX_BYTES = 100_000; // 100 KB serialized

const SENSITIVE_KEY_RE =
  /^(password|passwd|secret|token|api[_-]?key|auth(?:orization)?|credential|bearer|private[_-]?key|access[_-]?key)$/i;

/**
 * Recursively redacts values whose key matches SENSITIVE_KEY_RE.
 * Caps recursion at depth 10 to prevent stack overflow on adversarial input.
 */
export function redactSensitiveKeys(obj: unknown, depth = 0): unknown {
  if (depth > 10 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveKeys(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redactSensitiveKeys(v, depth + 1);
  }
  return result;
}

/**
 * Validates rawPayload: must be a plain object and must not exceed
 * RAW_PAYLOAD_MAX_BYTES when serialized. Returns error strings (empty = valid).
 */
export function validateRawPayload(payload: unknown): string[] {
  const errors: string[] = [];
  if (payload === undefined || payload === null) return errors;
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('rawPayload must be a JSON object');
    return errors;
  }
  const serialized = JSON.stringify(payload);
  if (serialized.length > RAW_PAYLOAD_MAX_BYTES) {
    errors.push(
      `rawPayload must not exceed ${RAW_PAYLOAD_MAX_BYTES.toLocaleString()} bytes when serialized`,
    );
  }
  return errors;
}

/**
 * Sanitizes rawPayload for storage: redacts sensitive keys recursively.
 * Returns null when payload is absent.
 */
export function sanitizeRawPayload(payload: unknown): Record<string, unknown> | null {
  if (payload === undefined || payload === null) return null;
  return redactSensitiveKeys(payload) as Record<string, unknown>;
}
