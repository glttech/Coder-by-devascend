export const featureFlags = {
  billingEnabled: process.env.FEATURE_BILLING === 'true',
  sandboxMode: process.env.FEATURE_SANDBOX_MODE === 'true',
  structuredLoggingEnabled: process.env.STRUCTURED_LOGGING === 'true',
  agentLlmEnabled: process.env.FEATURE_AGENT_LLM === 'true',
};
