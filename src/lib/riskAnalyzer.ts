export interface RiskFlag {
  key: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface RiskRule {
  key: string;
  label: string;
  severity: RiskFlag['severity'];
  pattern: RegExp;
  description: string;
}

const RISK_RULES: RiskRule[] = [
  {
    key: 'auth-security-change',
    label: 'Auth / Security path change',
    severity: 'high',
    pattern: /\b(auth(?:entication|orization)?|permission|role[- ]based|oauth|jwt|session(?:token|secret)?|middleware|cors|csrf|bcrypt|passport)\b/i,
    description: 'Response references authentication, authorization, or security-sensitive paths.',
  },
  {
    key: 'database-migration',
    label: 'Database / Migration change',
    severity: 'high',
    pattern: /\b(migrat(?:e|ion)|prisma\s+migrate|alter\s+table|schema\s+change|db:push|drop\s+column|add\s+column|rename\s+table|foreign\s+key)\b/i,
    description: 'Response references database schema changes or migrations.',
  },
  {
    key: 'production-environment',
    label: 'Production environment reference',
    severity: 'critical',
    pattern: /\b(production|prod\b|live\s+(?:environment|server|database)|live\s+site)\b/i,
    description: 'Response references the production environment.',
  },
  {
    key: 'secrets-exposure',
    label: 'Secrets / API key exposure',
    severity: 'critical',
    pattern: /(?:api[_\s-]?key|secret[_\s-]?key|password\s*=|token\s*=|\.env\b|private[_\s-]?key|sk-[a-z0-9]{8}|pk-[a-z0-9]{8}|bearer\s+[a-z0-9]{16})/i,
    description: 'Response may expose secrets, tokens, or API keys.',
  },
  {
    key: 'destructive-command',
    label: 'Destructive command detected',
    severity: 'critical',
    pattern: /\b(rm\s+-rf|drop\s+(?:table|database|schema)|truncate(?:\s+table)?|delete\s+from|git\s+push\s+(?:--force|-f)|git\s+reset\s+--hard|force-push)\b/i,
    description: 'Response contains potentially destructive commands that cannot be undone.',
  },
  {
    key: 'infra-docker-ci',
    label: 'Infra / Docker / CI change',
    severity: 'high',
    pattern: /\b(dockerfile|docker-compose|\.github\/workflows|\.github\/actions|ci\.ya?ml|github\s+actions|terraform|kubernetes|k8s|helm|ansible|infra(?:structure)?)\b/i,
    description: 'Response references infrastructure, Docker, or CI/CD configuration.',
  },
  {
    key: 'failed-ci-build',
    label: 'Failed build / test / CI',
    severity: 'high',
    pattern: /\b(build\s+failed|test\s+failed|ci\s+failed|compilation\s+error|type\s+error(?:s)?|lint\s+error(?:s)?|exit\s+code\s+[1-9]|✗|❌|FAIL\b|FAILED\b|failing\b)\b/i,
    description: 'Response indicates a failed build, test, or CI check.',
  },
];

export function analyzeRisk(text: string): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(text)) {
      flags.push({
        key: rule.key,
        label: rule.label,
        severity: rule.severity,
        description: rule.description,
      });
    }
  }
  return flags;
}

export function getRiskFlagDetails(keys: string[]): RiskFlag[] {
  return keys.flatMap((key) => {
    const rule = RISK_RULES.find((r) => r.key === key);
    return rule
      ? [{ key: rule.key, label: rule.label, severity: rule.severity, description: rule.description }]
      : [];
  });
}
