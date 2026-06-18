type Env = Record<string, string | undefined>;

export interface FeatureFlags {
  billingEnabled: boolean;
  /** When true, sandbox/preview mode is enabled — show planned impact before real execution. Off by default. */
  sandboxMode: boolean;
  structuredLoggingEnabled: boolean;
  agentLlmEnabled: boolean;
  orchestrationEnabled: boolean;
  notificationsEnabled: boolean;
}

export function getFeatureFlags(env: Env = process.env): FeatureFlags {
  return {
    billingEnabled: env.FEATURE_BILLING === 'true',
    sandboxMode: env.FEATURE_SANDBOX_MODE === 'true',
    structuredLoggingEnabled: env.STRUCTURED_LOGGING === 'true',
    agentLlmEnabled: env.FEATURE_AGENT_LLM === 'true',
    orchestrationEnabled: env.ORCHESTRATION_ENABLED === 'true',
    notificationsEnabled: env.NOTIFICATIONS_ENABLED === 'true',
  };
}

/** Singleton using process.env. Prefer getFeatureFlags() in tests. */
export const featureFlags = getFeatureFlags();
