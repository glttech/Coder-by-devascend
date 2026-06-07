import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, resolveAuthDecision } from '../authGuard.js';

// ── isPublicPath ──────────────────────────────────────────────────────────

describe('isPublicPath — always-public paths', () => {
  test('/login is public', () => assert.equal(isPublicPath('/login'), true));
  test('/favicon.ico is public', () => assert.equal(isPublicPath('/favicon.ico'), true));
  test('/api/auth/login is public', () => assert.equal(isPublicPath('/api/auth/login'), true));
  test('/api/auth/logout is public', () => assert.equal(isPublicPath('/api/auth/logout'), true));
  test('/api/auth/me is public', () => assert.equal(isPublicPath('/api/auth/me'), true));
  test('/_next/static/... is public', () => assert.equal(isPublicPath('/_next/static/chunks/main.js'), true));
  test('/_next/image is public', () => assert.equal(isPublicPath('/_next/image?url=x'), true));
});

describe('isPublicPath — protected paths', () => {
  test('/ is not public', () => assert.equal(isPublicPath('/'), false));
  test('/projects is not public', () => assert.equal(isPublicPath('/projects'), false));
  test('/tasks is not public', () => assert.equal(isPublicPath('/tasks'), false));
  test('/audit is not public', () => assert.equal(isPublicPath('/audit'), false));
  test('/api/tasks is not public', () => assert.equal(isPublicPath('/api/tasks'), false));
  test('/api/projects is not public', () => assert.equal(isPublicPath('/api/projects'), false));
  test('/login-extra is not public (exact match only)', () => assert.equal(isPublicPath('/login-extra'), false));
});

// ── resolveAuthDecision — disabled mode ──────────────────────────────────

describe('resolveAuthDecision — disabled mode', () => {
  const base = { mode: 'disabled' as const, isAuthenticated: false, governanceKeyValid: true, isApiPath: false };

  test('page route is allowed', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: false, pathname: '/projects' }), { action: 'allow' });
  });

  test('API route is allowed', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: false, isApiPath: true, pathname: '/api/tasks' }), { action: 'allow' });
  });

  test('public path is allowed', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: true, pathname: '/login' }), { action: 'allow' });
  });
});

// ── resolveAuthDecision — enforced mode, unauthenticated ─────────────────

describe('resolveAuthDecision — enforced, unauthenticated, no governance key', () => {
  const base = { mode: 'enforced' as const, isPublic: false, isAuthenticated: false, governanceKeyValid: false };

  test('page route redirects to login', () => {
    const d = resolveAuthDecision({ ...base, isApiPath: false, pathname: '/projects' });
    assert.deepEqual(d, { action: 'redirect_login', next: '/projects' });
  });

  test('API route returns 401', () => {
    const d = resolveAuthDecision({ ...base, isApiPath: true, pathname: '/api/tasks' });
    assert.deepEqual(d, { action: 'reject_401' });
  });

  test('redirect preserves original pathname', () => {
    const d = resolveAuthDecision({ ...base, isApiPath: false, pathname: '/tasks/123/report' });
    assert.ok(d.action === 'redirect_login');
    assert.equal(d.next, '/tasks/123/report');
  });
});

describe('resolveAuthDecision — enforced, valid governance key', () => {
  const base = { mode: 'enforced' as const, isPublic: false, isAuthenticated: false, governanceKeyValid: true };

  test('API route with valid governance key is allowed', () => {
    const d = resolveAuthDecision({ ...base, isApiPath: true, pathname: '/api/tasks' });
    assert.deepEqual(d, { action: 'allow' });
  });

  test('page route is not bypassed by governance key', () => {
    // Governance key only bypasses API routes
    const d = resolveAuthDecision({ ...base, isApiPath: false, pathname: '/projects' });
    assert.deepEqual(d, { action: 'redirect_login', next: '/projects' });
  });
});

describe('resolveAuthDecision — enforced, authenticated session', () => {
  const base = { mode: 'enforced' as const, isPublic: false, isAuthenticated: true, governanceKeyValid: false };

  test('page route is allowed with valid session', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isApiPath: false, pathname: '/projects' }), { action: 'allow' });
  });

  test('API route is allowed with valid session', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isApiPath: true, pathname: '/api/tasks' }), { action: 'allow' });
  });
});

describe('resolveAuthDecision — public paths bypass all auth', () => {
  test('login page is always allowed in enforced mode', () => {
    const d = resolveAuthDecision({
      mode: 'enforced', isPublic: true, isAuthenticated: false,
      governanceKeyValid: false, isApiPath: false, pathname: '/login',
    });
    assert.deepEqual(d, { action: 'allow' });
  });

  test('/api/auth/* is always allowed in enforced mode', () => {
    const d = resolveAuthDecision({
      mode: 'enforced', isPublic: true, isAuthenticated: false,
      governanceKeyValid: false, isApiPath: true, pathname: '/api/auth/login',
    });
    assert.deepEqual(d, { action: 'allow' });
  });
});

describe('resolveAuthDecision — misconfigured mode', () => {
  const base = { mode: 'misconfigured' as const, isAuthenticated: false, governanceKeyValid: false, isApiPath: false };

  test('non-public path returns 500', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: false, pathname: '/projects' }), { action: 'reject_500' });
  });

  test('API path returns 500', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: false, isApiPath: true, pathname: '/api/tasks' }), { action: 'reject_500' });
  });

  test('public path (login) is still allowed', () => {
    assert.deepEqual(resolveAuthDecision({ ...base, isPublic: true, pathname: '/login' }), { action: 'allow' });
  });
});

describe('resolveAuthDecision — no redirect loop', () => {
  test('/login is public so it always returns allow, never redirect_login', () => {
    const d = resolveAuthDecision({
      mode: 'enforced', isPublic: true, isAuthenticated: false,
      governanceKeyValid: false, isApiPath: false, pathname: '/login',
    });
    assert.equal(d.action, 'allow');
    assert.notEqual(d.action, 'redirect_login');
  });
});
