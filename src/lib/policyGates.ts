// Policy-as-code gate library.
//
// Defines configurable policy rules and an evaluation function that checks
// task instructions and metadata against those rules, returning any violations
// along with aggregate blocked/requiresApproval flags.

export type PolicyCategory =
  | 'migration'
  | 'auth'
  | 'env_config'
  | 'payment'
  | 'production'
  | 'secrets'
  | 'destructive'
  | 'infra';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: 'block' | 'require_approval';
  /** Patterns to match against task instruction (case-insensitive regex). */
  instructionPatterns: string[];
  /** Patterns to match against task title (case-insensitive regex). */
  titlePatterns?: string[];
  /** Which riskLevels trigger this rule. Empty / omitted = all levels. */
  riskLevels?: string[];
  /** Which environments trigger this rule. Empty / omitted = all environments. */
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
  /** true if any violation is 'block' */
  blocked: boolean;
  /** true if any violation is 'require_approval' */
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
    instructionPatterns: [
      'migration',
      'migrate',
      'alter table',
      'drop table',
      'create table',
      'schema change',
      'prisma migrate',
      'db:migrate',
    ],
    titlePatterns: ['migration', 'migrate', 'schema'],
  },
  {
    id: 'auth-changes',
    name: 'Auth / Session / RBAC Change',
    description: 'Task modifies authentication, session handling, or access control',
    category: 'auth',
    severity: 'block',
    instructionPatterns: [
      'authentication',
      'authorization',
      'session',
      'rbac',
      'role.based',
      'permission',
      'middleware auth',
      'jwt',
      'oauth',
      'login',
      'logout',
      'password',
    ],
    titlePatterns: ['auth', 'session', 'rbac', 'permission', 'login'],
    riskLevels: ['high'],
  },
  {
    id: 'env-config',
    name: 'Environment / Config Change',
    description: 'Task modifies environment variables, config files, or secrets',
    category: 'env_config',
    severity: 'block',
    instructionPatterns: [
      '\\.env',
      'environment variable',
      'config file',
      'secrets',
      'api.key',
      'api_key',
      'secret.key',
      'DATABASE_URL',
      'SESSION_SECRET',
    ],
  },
  {
    id: 'payment-billing',
    name: 'Payment / Billing Code',
    description: 'Task touches payment processing or billing logic',
    category: 'payment',
    severity: 'block',
    instructionPatterns: [
      'stripe',
      'payment',
      'billing',
      'invoice',
      'subscription',
      'checkout',
      'credit.card',
      'payment.gateway',
    ],
    titlePatterns: ['payment', 'billing', 'stripe'],
  },
  {
    id: 'production-deploy',
    name: 'Production / Deployment',
    description: 'Task targets production environment or deployment',
    category: 'production',
    severity: 'block',
    instructionPatterns: [
      'deploy to production',
      'production deploy',
      'release to prod',
      'push to prod',
    ],
    environments: ['production'],
  },
  {
    id: 'secrets-exposure',
    name: 'Secrets / Token Exposure',
    description: 'Task may expose or log secrets, tokens, or credentials',
    category: 'secrets',
    severity: 'block',
    instructionPatterns: [
      'print.*secret',
      'log.*token',
      'console.log.*key',
      'expose.*credential',
      'output.*password',
    ],
  },
  {
    id: 'destructive-commands',
    name: 'Destructive Commands',
    description: 'Task involves irreversible destructive operations',
    category: 'destructive',
    severity: 'require_approval',
    instructionPatterns: [
      'rm -rf',
      'drop database',
      'truncate',
      'delete all',
      'wipe',
      'purge',
      'git push --force',
      'force push',
    ],
  },
  {
    id: 'infra-changes',
    name: 'Infrastructure / Docker / CI Change',
    description: 'Task modifies infrastructure, Docker, or CI/CD configuration',
    category: 'infra',
    severity: 'require_approval',
    instructionPatterns: [
      'dockerfile',
      'docker-compose',
      'kubernetes',
      'terraform',
      'ci/cd',
      'github.action',
      'workflow.yml',
      '\\.github/workflows',
      'nginx',
      'infrastructure',
    ],
    titlePatterns: ['infra', 'docker', 'ci', 'deploy', 'k8s'],
  },
];

/**
 * Returns true if any of the given regex patterns match the text
 * (case-insensitive). Falls back to plain substring match if the
 * pattern is not valid regex.
 */
function matchesPatterns(text: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p, 'i').test(text);
    } catch {
      return text.toLowerCase().includes(p.toLowerCase());
    }
  });
}

/**
 * Evaluate a set of policy rules against a task's metadata.
 *
 * A rule fires when ALL of the following are true:
 *   1. Its `riskLevels` constraint is met (or is not set).
 *   2. At least one `instructionPattern` or `titlePattern` matches.
 *   3. If `environments` is set: the task environment is in the list.
 *      (Exception: if an instructionPattern already matches, the rule still
 *      fires even without an environment match — so instruction-based
 *      production-keyword detection works regardless of the environment field.)
 *
 * Returns the list of violations and aggregate flags.
 */
export function evaluatePolicy(
  input: { title: string; instruction: string; riskLevel: string; environment: string },
  rules: PolicyRule[] = DEFAULT_POLICY_RULES,
): PolicyEvalResult {
  const violations: PolicyViolation[] = [];

  for (const rule of rules) {
    // 1. Skip if riskLevel constraint is set but not satisfied.
    if (
      rule.riskLevels &&
      rule.riskLevels.length > 0 &&
      !rule.riskLevels.includes(input.riskLevel)
    ) {
      continue;
    }

    const instrMatch = matchesPatterns(input.instruction, rule.instructionPatterns);
    const titleMatch =
      rule.titlePatterns ? matchesPatterns(input.title, rule.titlePatterns) : false;

    // 2. Check environment constraint.
    if (rule.environments && rule.environments.length > 0) {
      const envMatch = rule.environments.includes(input.environment);
      // Rule fires if environment matches AND a pattern matches,
      // OR if an instruction pattern matches (env-keyword detection).
      if (!envMatch && !instrMatch) {
        continue;
      }
    }

    // 3. A pattern must match.
    if (!instrMatch && !titleMatch) {
      continue;
    }

    violations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      reason: rule.description,
    });
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
