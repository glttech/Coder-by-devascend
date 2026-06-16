import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORG_ID, scoped } from '../orgScope';

describe('orgScope', () => {
  it('DEFAULT_ORG_ID should be org_default', () => {
    assert.equal(DEFAULT_ORG_ID, 'org_default');
  });

  it('scoped() should return an object with orgId', () => {
    const result = scoped('some-org-id');
    assert.deepEqual(result, { orgId: 'some-org-id' });
  });

  it('scoped() should work with DEFAULT_ORG_ID', () => {
    const result = scoped(DEFAULT_ORG_ID);
    assert.deepEqual(result, { orgId: 'org_default' });
  });
});
