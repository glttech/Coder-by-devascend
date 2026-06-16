import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveOrgId, DEFAULT_ORG_ID, orgWhere } from '../orgScope.js';

describe('getActiveOrgId', () => {
  test('returns DEFAULT_ORG_ID when session is null', () => {
    assert.equal(getActiveOrgId(null), DEFAULT_ORG_ID);
  });
  test('returns DEFAULT_ORG_ID when session has no orgId', () => {
    assert.equal(getActiveOrgId({ orgId: undefined }), DEFAULT_ORG_ID);
  });
  test('returns session orgId when set', () => {
    assert.equal(getActiveOrgId({ orgId: 'org_custom' }), 'org_custom');
  });
});

describe('orgWhere', () => {
  test('returns where fragment with orgId', () => {
    assert.deepEqual(orgWhere('org_123'), { orgId: 'org_123' });
  });
});
