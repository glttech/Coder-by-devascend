/**
 * Retry wrapper for fetch with exponential back-off.
 *
 * Retries on:
 *   - HTTP 429 (rate limited)
 *   - HTTP 5xx (server errors)
 *   - Network errors (fetch throws)
 *
 * Does NOT retry on any other status code (e.g. 404, 401, 200).
 */
export async function retryFetch(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<Response> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxAttempts) {
          await new Promise<void>((r) => setTimeout(r, baseDelayMs * attempt));
          continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise<void>((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
