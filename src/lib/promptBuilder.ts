import { Task } from '@prisma/client';

type TaskWithProject = Task & { project?: { name: string } | null };

const AGENT_CONTEXT: Record<string, string> = {
  'claude-code-manual': 'Claude Code CLI (manual operator)',
  'codex-manual':       'OpenAI Codex (manual operator)',
  'openclaw-manual':    'OpenClaw (manual operator)',
  'open-swe':           'Open SWE agent',
};

const ENV_GUARD: Record<string, string> = {
  local:      'You are working in a LOCAL development environment. No shared systems are affected.',
  dev:        'You are working in the DEV environment. Do not touch staging or production.',
  staging:    'You are working in the STAGING environment. Treat it carefully — do not touch production.',
  production: 'PRODUCTION ENVIRONMENT. Every action is irreversible and affects live users. Extreme caution required.',
};

const STOP_CONDITIONS = [
  'STOP if you need to run a migration or alter the database schema — report back first.',
  'STOP if any test or build fails and you cannot fix it cleanly — do not force or skip.',
  'STOP if you need to touch .env files, secrets, or credentials.',
  'STOP if the scope of the change is larger than expected — report back before continuing.',
  'STOP if you encounter production systems, production data, or production credentials.',
];

export function buildPrompt(task: TaskWithProject): string {
  const projectName  = task.project?.name ?? task.projectId ?? 'unknown';
  const agentLabel   = AGENT_CONTEXT[task.agentTool] ?? task.agentTool;
  const envGuard     = ENV_GUARD[task.environment] ?? `Environment: ${task.environment}.`;
  const riskNote     = task.riskLevel === 'high'
    ? 'Risk level is HIGH — every change must be minimal, targeted, and reversible.'
    : task.riskLevel === 'medium'
    ? 'Risk level is MEDIUM — avoid side-effects beyond the stated objective.'
    : 'Risk level is LOW — follow standard safe-change practices.';

  return [
    `Objective:\n${task.instruction}`,

    `Scope:\nProject: ${projectName}\nAgent: ${agentLabel}\n${envGuard}\n${riskNote}\n\n` +
    `Make changes only within the scope of the objective above. Do not modify files unrelated to the task.`,

    `Files / areas to inspect:\n` +
    `List the files you plan to read or modify before making any changes. ` +
    `For each file, state why it is relevant to the objective.`,

    `Files / areas NOT to touch:\n` +
    `- .env files or any file containing secrets or credentials\n` +
    `- Production configuration or production infrastructure\n` +
    `- Database schema (prisma/schema.prisma) unless explicitly instructed\n` +
    `- Files unrelated to the stated objective`,

    `Safety constraints:\n` +
    STOP_CONDITIONS.map((c) => `- ${c}`).join('\n') +
    `\n\nDo not run destructive commands (rm -rf, DROP TABLE, git reset --hard, force push) without explicit approval.\n` +
    `Do not install new dependencies without approval. Do not refactor code beyond the task scope.`,

    `Exact expected changes:\n` +
    `Before making any change, list:\n` +
    `1. Every file you will modify (exact path)\n` +
    `2. What you will change in each file and why\n` +
    `3. Any new files you will create\n` +
    `Confirm this list before proceeding.`,

    `Validation commands / checks:\n` +
    `After making your changes, run ALL of the following that apply:\n` +
    `- npm run build  (TypeScript compile + Next.js build)\n` +
    `- npm test       (unit tests)\n` +
    `- npm run lint   (if configured)\n\n` +
    `Report the exact output of each command, not a summary. If any command fails, fix only the reported error, then rerun.`,

    `Required final report format:\n` +
    `- Summary: what was done (2-4 sentences)\n` +
    `- Files changed: list with paths\n` +
    `- Commands run: list in order with exit codes\n` +
    `- Tests / build result: exact output or "passed"\n` +
    `- Risks or blockers: any concerns, edge cases, or things not done\n` +
    `- Commit hash: if committed\n` +
    `- What was NOT changed and why`,
  ].join('\n\n');
}
