import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { retryFetch } from '../retryFetch.js';

// Helper to build a mock Response
function mockResponse(status: number, body = '{}'): Response {
  return new Response(body, { status });
}

describe('retryFetch', () => {
  // Save the real fetch
  let originalFetch: typeof globalThis.fetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns response on first success (200)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return mockResponse(200);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 200);
    assert.equal(calls, 1, 'should not retry on success');
  });

  it('does not retry on 404', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return mockResponse(404);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 404);
    assert.equal(calls, 1, 'should not retry on 404');
  });

  it('retries on 500 status and eventually returns final response', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls < 3) return mockResponse(500);
      return mockResponse(200);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 200);
    assert.equal(calls, 3);
  });

  it('retries on 429 rate limit', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return mockResponse(429);
      return mockResponse(200);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  });

  it('retries on network error', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls < 3) throw new Error('network failure');
      return mockResponse(200);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 200);
    assert.equal(calls, 3);
  });

  it('throws after max attempts on persistent network error', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error('always fails');
    };
    await assert.rejects(
      () => retryFetch('https://example.com', {}, 3, 0),
      /always fails/,
    );
    assert.equal(calls, 3);
  });

  it('returns 500 response after max attempts when server always errors', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return mockResponse(500);
    };
    const res = await retryFetch('https://example.com', {}, 3, 0);
    assert.equal(res.status, 500);
    assert.equal(calls, 3, 'should attempt exactly maxAttempts times');
  });
});
