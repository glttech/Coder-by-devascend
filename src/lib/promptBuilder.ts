import { Task } from '@prisma/client';

type TaskWithProject = Task & { project?: { name: string } | null };

/**
 * Construct a structured execution prompt for a given task.  This helper
 * encapsulates the default format defined in the Phase 1 requirements.
 *
 * You can customise the sections or inject additional context (e.g. repo
 * details) here.  For now we derive most sections from the task itself and
 * leave others blank for the agent to interpret.
 */
export function buildPrompt(task: TaskWithProject): string {
  const projectName = task.project?.name ?? task.projectId ?? 'unknown';
  return [
    `Objective:\n${task.instruction}`,
    `Scope:\nPlease make changes only within the scope of the project ${projectName} as relevant to the objective.`,
    `Files/areas to inspect:\nSpecify relevant files based on the objective.`,
    `Files/areas not to touch:\nDo not modify files unrelated to the task.`,
    `Safety constraints:\nFollow best practices and avoid any destructive commands or production access.`,
    `Exact expected changes:\nList the specific modifications you intend to make.`,
    `Validation commands/checks:\nDescribe how you will verify your changes (e.g. run tests, build commands).`,
    `Required final report format:\n- Summary\n- Files changed\n- Commands run\n- Tests/build result\n- Risks or blockers\n- Commit hash if committed\n- What was not changed`,
  ].join('\n\n');
}
