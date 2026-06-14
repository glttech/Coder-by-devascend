export type PolicyCategory = 'migration' | 'auth' | 'env_config' | 'payment' | 'production' | 'secrets' | 'destructive' | 'infra';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: 'block' | 'require_approval';
  instructionPatterns: string[];
  titlePatterns?: string[];
  riskLevels?: string[];
  environments?: string[];
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  category: PolicyCategory;
  severity: 'block' | 'require_approval';
  reason: string;
}

export interface PolicyEvalResult {
  violations: PolicyViolation[];
  blocked: boolean;
  requiresApproval: boolean;
  highestSeverity: 'block' | 'require_approval' | 'none';
}

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'db-migration',
    name: 'Database Migration',
    description: 'Task involves database schema changes or migrations',
    category: 'migration',
    severity: 'require_approval',
    instructionPatterns: ['migration', 'migrate', 'alter table', 'drop table', 'create table', 'schema change', 'prisma migrate', 'db:migrate'],
    titlePatterns: ['migration', 'migrate', 'schema'],
  },
  {
    id: 'auth-changes',
    name: 'Auth / Session / RBAC Change',
    description: 'Task modifies authentication, session handling, or access control',
    category: 'auth',
    severity: 'block',
    instructionPatterns: ['authentication', 'authorization', 'session', 'rbac', 'permission', 'middleware auth', 'jwt', 'oauth'],
    titlePatterns: ['auth', 'session', 'rbac', 'permission'],
    riskLevels: ['high'],
  },
  {
    id: 'env-config',
    name: 'Environment / Config Change',
    description: 'Task modifies environment variables, config files, or secrets',
    category: 'env_config',
    severity: 'block',
    instructionPatterns: ['\\.env', 'environment variable', 'config file', 'DATABASE_URL', 'SESSION_SECRET', 'api.key', 'api_key'],
  },
  {
    id: 'payment-billing',
    name: 'Payment / Billing Code',
    description: 'Task touches payment processing or billing logic',
    category: 'payment',
    severity: 'block',
    instructionPatterns: ['stripe', 'payment', 'billing', 'invoice', 'subscription', 'checkout', 'credit.card'],
    titlePatterns: ['payment', 'billing', 'stripe'],
  },
  {
    id: 'production-deploy',
    name: 'Production / Deployment',
    description: 'Task targets production environment or deployment',
    category: 'production',
    severity: 'block',
    instructionPatterns: ['deploy to production', 'production deploy', 'release to prod', 'push to prod'],
    environments: ['production'],
  },
  {
    id: 'secrets-exposure',
    name: 'Secrets / Token Exposure',
    description: 'Task may expose or log secrets, tokens, or credentials',
    category: 'secrets',
    severity: 'block',
    instructionPatterns: ['print.*secret', 'log.*token', 'console.log.*key', 'expose.*credential', 'output.*password'],
  },
  {
    id: 'destructive-commands',
    name: 'Destructive Commands',
    description: 'Task involves irreversible destructive operations',
    category: 'destructive',
    severity: 'require_approval',
    instructionPatterns: ['rm -rf', 'drop database', 'truncate', 'delete all', 'wipe', 'purge', 'git push --force', 'force push'],
  },
  {
    id: 'infra-changes',
    name: 'Infrastructure / Docker / CI Change',
    description: 'Task modifies infrastructure, Docker, or CI/CD configuration',
    category: 'infra',
    severity: 'require_approval',
    instructionPatterns: ['dockerfile', 'docker-compose', 'kubernetes', 'terraform', 'ci/cd', 'github.action', 'workflow.yml', '.github/workflows', 'nginx', 'infrastructure'],
    titlePatterns: ['infra', 'docker', 'deploy', 'k8s'],
  },
];

function matchesPatterns(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => {
    try {
      return new RegExp(p, 'i').test(lower);
    } catch {
      return lower.includes(p.toLowerCase());
    }
  });
}

export function evaluatePolicy(
  input: { title: string; instruction: string; riskLevel: string; environment: string },
  rules: PolicyRule[] = DEFAULT_POLICY_RULES,
): PolicyEvalResult {
  const violations: PolicyViolation[] = [];

  for (const rule of rules) {
    if (rule.riskLevels && rule.riskLevels.length > 0 && !rule.riskLevels.includes(input.riskLevel)) {
      continue;
    }
    if (rule.environments && rule.environments.length > 0 && !rule.environments.includes(input.environment)) {
      // Only skip if environments is set AND input.environment doesn't match
      // Exception: for production-deploy rule, also check instruction patterns
      if (!matchesPatterns(input.instruction, rule.instructionPatterns)) {
        continue;
      }
    }

    const instrMatch = matchesPatterns(input.instruction, rule.instructionPatterns);
    const titleMatch = rule.titlePatterns ? matchesPatterns(input.title, rule.titlePatterns) : false;

    if (instrMatch || titleMatch) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        severity: rule.severity,
        reason: rule.description,
      });
    }
  }

  const blocked = violations.some((v) => v.severity === 'block');
  const requiresApproval = violations.some((v) => v.severity === 'require_approval');
  const highestSeverity: PolicyEvalResult['highestSeverity'] = blocked
    ? 'block'
    : requiresApproval
    ? 'require_approval'
    : 'none';

  return { violations, blocked, requiresApproval, highestSeverity };
}
