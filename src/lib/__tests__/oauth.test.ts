import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('GitHub OAuth URL', () => {
  test('getGithubAuthUrl includes client_id param', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    const { getGithubAuthUrl } = await import('../oauth/github');
    const url = getGithubAuthUrl('test-state');
    assert.ok(url.includes('client_id=test-client-id'));
    assert.ok(url.includes('state=test-state'));
    assert.ok(url.startsWith('https://github.com/login/oauth/authorize'));
  });

  test('getGithubAuthUrl includes scope=user:email', async () => {
    const { getGithubAuthUrl } = await import('../oauth/github');
    const url = getGithubAuthUrl('abc');
    assert.ok(url.includes('scope=user%3Aemail') || url.includes('scope=user:email'));
  });
});
