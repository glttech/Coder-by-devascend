type Env = Record<string, string | undefined>;

export interface FeatureFlags {
  orchestrationEnabled: boolean;
  /** When true, the in-app notifications system is active. Off by default. */
  notificationsEnabled: boolean;
}

export function getFeatureFlags(env: Env = process.env): FeatureFlags {
  return {
    orchestrationEnabled: env.ORCHESTRATION_ENABLED === 'true',
    notificationsEnabled: env.NOTIFICATIONS_ENABLED === 'true',
  };
}
