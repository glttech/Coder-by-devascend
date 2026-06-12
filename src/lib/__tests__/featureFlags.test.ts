import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getFeatureFlags } from '../featureFlags.js';

describe('getFeatureFlags — orchestrationEnabled', () => {
  test('orchestrationEnabled is false when env is empty', () => {
    assert.equal(getFeatureFlags({}).orchestrationEnabled, false);
  });

  test("orchestrationEnabled is false when ORCHESTRATION_ENABLED='false'", () => {
    assert.equal(getFeatureFlags({ ORCHESTRATION_ENABLED: 'false' }).orchestrationEnabled, false);
  });

  test('orchestrationEnabled is false when ORCHESTRATION_ENABLED is unrelated string', () => {
    assert.equal(getFeatureFlags({ ORCHESTRATION_ENABLED: '1' }).orchestrationEnabled, false);
  });

  test("orchestrationEnabled is true when ORCHESTRATION_ENABLED='true'", () => {
    assert.equal(getFeatureFlags({ ORCHESTRATION_ENABLED: 'true' }).orchestrationEnabled, true);
  });

  test('getFeatureFlags returns an object with orchestrationEnabled key', () => {
    const flags = getFeatureFlags({});
    assert.ok(Object.prototype.hasOwnProperty.call(flags, 'orchestrationEnabled'));
  });

  test('calling with no argument reads process.env without throwing', () => {
    // Smoke test: ensure the default parameter (process.env) works
    const flags = getFeatureFlags();
    assert.equal(typeof flags.orchestrationEnabled, 'boolean');
  });
});
