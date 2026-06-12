import { validateAuthConfig, getAuthMode } from './session';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
}

export interface ReadinessReport {
  overallStatus: CheckStatus; // worst of all individual statuses
  checks: CheckResult[];
  generatedAt: string; // ISO timestamp
}

/** Computes the worst status across all checks (fail > warn > pass). */
function worstStatus(checks: CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

export async function runReadinessChecks(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Promise<ReadinessReport> {
  const checks: CheckResult[] = [];

  // 1. Auth config
  const authValidation = validateAuthConfig(env);
  checks.push({
    name: 'Auth config',
    status: authValidation.ok ? 'pass' : 'fail',
    message: authValidation.ok
      ? 'Auth configuration is valid'
      : authValidation.error,
  });

  // 2. Session secret strength (only when auth is enforced)
  const authMode = getAuthMode(env);
  if (authMode === 'enforced') {
    const secret = env.SESSION_SECRET ?? '';
    let secretStatus: CheckStatus;
    let secretMessage: string;
    if (secret.length >= 64) {
      secretStatus = 'pass';
      secretMessage = 'SESSION_SECRET length is strong (>= 64 chars)';
    } else if (secret.length >= 32) {
      secretStatus = 'warn';
      secretMessage =
        'SESSION_SECRET meets the minimum (32 chars) but is short — consider using >= 64 chars';
    } else {
      // validateAuthConfig already caught < 32 as a fail, but we include a consistent entry
      secretStatus = 'fail';
      secretMessage = 'SESSION_SECRET is too short (< 32 chars)';
    }
    checks.push({
      name: 'Session secret strength',
      status: secretStatus,
      message: secretMessage,
    });
  }

  // 3. Database URL set
  const hasDbUrl = Boolean(env.DATABASE_URL);
  checks.push({
    name: 'Database URL set',
    status: hasDbUrl ? 'pass' : 'fail',
    message: hasDbUrl ? 'DATABASE_URL is set' : 'DATABASE_URL is not set',
  });

  // 4. Orchestration flag
  const orchestrationEnabled = env.ORCHESTRATION_ENABLED === 'true';
  checks.push({
    name: 'Orchestration flag',
    status: orchestrationEnabled ? 'warn' : 'pass',
    message: orchestrationEnabled
      ? 'Orchestration is enabled — ensure agents are configured'
      : 'Orchestration is disabled (expected for non-orchestration deployments)',
  });

  // 5. NODE_ENV
  const nodeEnv = env.NODE_ENV;
  checks.push({
    name: 'NODE_ENV',
    status: nodeEnv === 'production' ? 'pass' : 'warn',
    message:
      nodeEnv === 'production'
        ? 'NODE_ENV is production'
        : `NODE_ENV is "${nodeEnv ?? 'unset'}" — acceptable for pre-prod but should be "production" in production`,
  });

  // 6. Migrations — check that prisma/migrations/ directory exists and has at least one migration
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
  let migrationsStatus: CheckStatus;
  let migrationsMessage: string;
  try {
    if (!existsSync(migrationsDir)) {
      migrationsStatus = 'warn';
      migrationsMessage = 'prisma/migrations/ directory does not exist';
    } else {
      const entries = readdirSync(migrationsDir, { withFileTypes: true });
      const migrationFolders = entries.filter((e) => e.isDirectory());
      if (migrationFolders.length === 0) {
        migrationsStatus = 'warn';
        migrationsMessage = 'prisma/migrations/ exists but contains no migration folders';
      } else {
        migrationsStatus = 'pass';
        migrationsMessage = `prisma/migrations/ has ${migrationFolders.length} migration folder${migrationFolders.length !== 1 ? 's' : ''}`;
      }
    }
  } catch {
    migrationsStatus = 'warn';
    migrationsMessage = 'Could not read prisma/migrations/ directory';
  }
  checks.push({
    name: 'Migrations',
    status: migrationsStatus,
    message: migrationsMessage,
  });

  return {
    overallStatus: worstStatus(checks),
    checks,
    generatedAt: new Date().toISOString(),
  };
}
