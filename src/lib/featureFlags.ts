type Env = Record<string, string | undefined>;

export interface FeatureFlags {
  orchestrationEnabled: boolean;
  /** When true, the in-app notifications system is active. Off by default. */
  notificationsEnabled: boolean;
  /** When true, sandbox/preview mode is enabled — show planned impact before real execution. Off by default. */
  sandboxMode: boolean;
}

export function getFeatureFlags(env: Env = process.env): FeatureFlags {
  return {
    orchestrationEnabled: env.ORCHESTRATION_ENABLED === 'true',
    notificationsEnabled: env.NOTIFICATIONS_ENABLED === 'true',
    sandboxMode: env.FEATURE_SANDBOX_MODE === 'true',
  };
}
