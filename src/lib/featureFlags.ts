type Env = Record<string, string | undefined>;

export interface FeatureFlags {
  orchestrationEnabled: boolean;
}

export function getFeatureFlags(env: Env = process.env): FeatureFlags {
  return {
    orchestrationEnabled: env.ORCHESTRATION_ENABLED === 'true',
  };
}
