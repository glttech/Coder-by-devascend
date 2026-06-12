import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTerminalStatus,
  isActiveStatus,
  canTransitionTo,
} from '../orchestration.js';
import { getFeatureFlags } from '../featureFlags.js';

describe('isTerminalStatus', () => {
  it('returns true for succeeded', () => {
    assert.equal(isTerminalStatus('succeeded'), true);
  });

  it('returns true for failed', () => {
    assert.equal(isTerminalStatus('failed'), true);
  });

  it('returns true for blocked', () => {
    assert.equal(isTerminalStatus('blocked'), true);
  });

  it('returns true for cancelled', () => {
    assert.equal(isTerminalStatus('cancelled'), true);
  });

  it('returns false for running', () => {
    assert.equal(isTerminalStatus('running'), false);
  });

  it('returns false for draft', () => {
    assert.equal(isTerminalStatus('draft'), false);
  });
});

describe('isActiveStatus', () => {
  it('returns true for running', () => {
    assert.equal(isActiveStatus('running'), true);
  });

  it('returns true for queued', () => {
    assert.equal(isActiveStatus('queued'), true);
  });

  it('returns false for cancelled', () => {
    assert.equal(isActiveStatus('cancelled'), false);
  });

  it('returns false for succeeded', () => {
    assert.equal(isActiveStatus('succeeded'), false);
  });
});

describe('canTransitionTo', () => {
  it('allows draft → awaiting_approval', () => {
    assert.equal(canTransitionTo('draft', 'awaiting_approval'), true);
  });

  it('disallows draft → running (must go through awaiting_approval)', () => {
    assert.equal(canTransitionTo('draft', 'running'), false);
  });

  it('disallows succeeded → running (terminal state)', () => {
    assert.equal(canTransitionTo('succeeded', 'running'), false);
  });

  it('allows awaiting_approval → blocked', () => {
    assert.equal(canTransitionTo('awaiting_approval', 'blocked'), true);
  });

  it('allows awaiting_approval → queued', () => {
    assert.equal(canTransitionTo('awaiting_approval', 'queued'), true);
  });

  it('allows queued → running', () => {
    assert.equal(canTransitionTo('queued', 'running'), true);
  });

  it('allows running → succeeded', () => {
    assert.equal(canTransitionTo('running', 'succeeded'), true);
  });

  it('allows running → failed', () => {
    assert.equal(canTransitionTo('running', 'failed'), true);
  });

  it('disallows failed → running (terminal state)', () => {
    assert.equal(canTransitionTo('failed', 'running'), false);
  });

  it('disallows cancelled → draft (terminal state)', () => {
    assert.equal(canTransitionTo('cancelled', 'draft'), false);
  });
});

describe('getFeatureFlags', () => {
  it('returns orchestrationEnabled=true when ORCHESTRATION_ENABLED is "true"', () => {
    const flags = getFeatureFlags({ ORCHESTRATION_ENABLED: 'true' });
    assert.equal(flags.orchestrationEnabled, true);
  });

  it('returns orchestrationEnabled=false when ORCHESTRATION_ENABLED is absent', () => {
    const flags = getFeatureFlags({});
    assert.equal(flags.orchestrationEnabled, false);
  });

  it('returns orchestrationEnabled=false when ORCHESTRATION_ENABLED is "false"', () => {
    const flags = getFeatureFlags({ ORCHESTRATION_ENABLED: 'false' });
    assert.equal(flags.orchestrationEnabled, false);
  });
});
