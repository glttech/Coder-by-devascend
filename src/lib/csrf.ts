/**
 * CSRF token utilities.
 *
 * generateCsrfToken() is called only from Node.js Route Handlers, so it may
 * use the Node.js `crypto` module.  validateCsrfToken() is called from
 * middleware (Edge Runtime), so it must NOT import any Node.js-only module at
 * the top level — it uses a manual constant-time comparison instead.
 */

// Dynamic import used here so that `crypto` is NOT bundled into the Edge
// Runtime chunk.  The function is only called from Route Handlers which run in
// the Node.js runtime, so the dynamic import is always available.
export async function generateCsrfToken(): Promise<string> {
  const { randomBytes } = await import('crypto');
  return randomBytes(32).toString('hex');
}

/**
 * Constant-time string comparison that is safe to use in the Edge Runtime.
 * Returns true only when both non-empty strings are identical.
 */
export function validateCsrfToken(
  provided: string | null,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  // Manual constant-time comparison — no Node.js module required.
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
