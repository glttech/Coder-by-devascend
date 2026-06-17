import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerProvider,
  getProvider,
  listProviders,
  clearRegistry,
} from '../providers/index.js';
import type { AgentProviderAdapter, AgentRunInput, AgentRunOutput } from '../providers/index.js';

function makeAdapter(type: string): AgentProviderAdapter {
  return {
    type,
    async run(_input: AgentRunInput): Promise<AgentRunOutput> {
      return { status: 'succeeded' };
    },
  };
}

describe('providerRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registerProvider adds provider to registry', () => {
    const adapter = makeAdapter('mock');
    registerProvider(adapter);
    assert.equal(getProvider('mock'), adapter);
  });

  it('getProvider returns registered provider', () => {
    const adapter = makeAdapter('claude-code');
    registerProvider(adapter);
    const result = getProvider('claude-code');
    assert.ok(result !== undefined);
    assert.equal(result.type, 'claude-code');
  });

  it('getProvider returns undefined for unknown type', () => {
    const result = getProvider('nonexistent');
    assert.equal(result, undefined);
  });

  it('listProviders returns all registered providers', () => {
    const a = makeAdapter('mock');
    const b = makeAdapter('claude-code');
    const c = makeAdapter('open-swe');
    registerProvider(a);
    registerProvider(b);
    registerProvider(c);
    const providers = listProviders();
    assert.equal(providers.length, 3);
    const types = providers.map((p) => p.type).sort();
    assert.deepEqual(types, ['claude-code', 'mock', 'open-swe']);
  });

  it('clearRegistry empties the registry', () => {
    registerProvider(makeAdapter('mock'));
    registerProvider(makeAdapter('claude-code'));
    clearRegistry();
    assert.equal(listProviders().length, 0);
    assert.equal(getProvider('mock'), undefined);
  });

  it('registering same type overwrites previous', () => {
    const first = makeAdapter('mock');
    const second = makeAdapter('mock');
    registerProvider(first);
    registerProvider(second);
    const result = getProvider('mock');
    assert.equal(result, second);
    assert.equal(listProviders().length, 1);
  });
});
