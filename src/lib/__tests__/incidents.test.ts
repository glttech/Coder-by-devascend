import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { incidentSeverityFromRisk } from '../incidentHelpers.js';

describe('incidentSeverityFromRisk', () => {
  test('returns "high" for riskLevel "high"', () => {
    assert.equal(incidentSeverityFromRisk('high'), 'high');
  });

  test('returns "medium" for riskLevel "medium"', () => {
    assert.equal(incidentSeverityFromRisk('medium'), 'medium');
  });

  test('returns "low" for riskLevel "low"', () => {
    assert.equal(incidentSeverityFromRisk('low'), 'low');
  });

  test('returns "low" for unknown riskLevel', () => {
    assert.equal(incidentSeverityFromRisk('unknown'), 'low');
  });
});
