import type { AgentProviderAdapter } from './types.js';

// Singleton registry map: type → adapter instance
const registry = new Map<string, AgentProviderAdapter>();

export function registerProvider(adapter: AgentProviderAdapter): void {
  registry.set(adapter.type, adapter);
}

export function getProvider(type: string): AgentProviderAdapter | undefined {
  return registry.get(type);
}

export function listProviders(): AgentProviderAdapter[] {
  return Array.from(registry.values());
}

export function clearRegistry(): void {
  registry.clear();
}
