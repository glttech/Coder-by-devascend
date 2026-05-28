import type { DecisionCode } from './decisionEngine';
import type { RiskFlag } from './riskAnalyzer';
import type { MissingEvidence } from './evidenceChecker';

export interface NextPromptInput {
  decision: DecisionCode;
  riskFlags: RiskFlag[];
  missingEvidence: MissingEvidence[];
  taskTitle: string;
  filesMentioned: string[];
}

export function generateNextPrompt(input: NextPromptInput): string {
  const riskKeys = new Set(input.riskFlags.map((f) => f.key));
  const missingKeys = new Set(input.missingEvidence.map((e) => e.key));

  if (input.decision === 'BLOCKED') {
    if (riskKeys.has('destructive-command')) {
      return [
        'STOP — Do not execute any further commands.',
        '',
        'A destructive command was detected in your last response.',
        '',
        'Before anything else:',
        '1. Confirm exactly which commands you have already run and which you have NOT run yet.',
        '2. Confirm that no destructive command has already been executed.',
        '3. List the current state of every file you touched.',
        '4. Do not proceed until a senior engineer has reviewed your plan.',
        '',
        'Report: what have you done so far, and what were you about to do?',
      ].join('\n');
    }
    if (riskKeys.has('secrets-exposure')) {
      return [
        'STOP — A potential secret, token, or API key was detected in your last response.',
        '',
        '1. Do not share, log, or output any credentials, tokens, or keys in further responses.',
        '2. If you included a real secret, report it immediately so it can be rotated.',
        '3. Do not continue with any task until this is confirmed safe.',
        '',
        'Confirm: did you include a real credential? If yes, which service or system does it belong to?',
      ].join('\n');
    }
    return [
      'STOP — This action is blocked pending senior engineer review.',
      '',
      'Do not proceed. Report the exact current state of the codebase and what you were about to do next.',
    ].join('\n');
  }

  if (input.decision === 'SENIOR_APPROVAL_REQUIRED') {
    const riskLabels = input.riskFlags.map((f) => `- ${f.label}: ${f.description}`).join('\n');
    const fileContext = input.filesMentioned.length > 0
      ? `\nFiles you changed: ${input.filesMentioned.slice(0, 5).join(', ')}`
      : '';
    return [
      `PAUSE — Senior approval required for: "${input.taskTitle}"`,
      '',
      'The following high-risk areas were detected in your response:',
      riskLabels,
      '',
      'Before any further action, provide:',
      '1. Summary of every change made so far (not a description of intent — what actually changed).',
      '2. Every file modified (exact paths) and every command run, in order.',
      '3. What you intend to do next and why.',
      '4. Any concerns or irreversible actions already taken.' + fileContext,
      '',
      'Do not make any further changes until a senior engineer has reviewed and explicitly approved.',
    ].join('\n');
  }

  if (input.decision === 'ASK_AGENT_FOR_EVIDENCE') {
    const lines = [
      `Before we continue with: "${input.taskTitle}"`,
      '',
      'Please provide the following evidence from your last action:',
    ];
    if (missingKeys.has('files-changed')) {
      lines.push('- Exact list of files you modified (relative paths from repo root)');
    }
    if (missingKeys.has('commands-run')) {
      lines.push('- Exact commands you ran, in the order you ran them');
    }
    if (missingKeys.has('validation-output')) {
      lines.push('- Full output of any build, test, or lint command you ran (not a summary — the exact output)');
    }
    lines.push(
      '',
      'Do not move to the next step until you have provided this evidence.',
    );
    return lines.join('\n');
  }

  if (input.decision === 'RUN_VALIDATION') {
    const fileContext =
      input.filesMentioned.length > 0
        ? `Files changed: ${input.filesMentioned.slice(0, 5).join(', ')}.`
        : 'Files were changed in the last step.';
    return [
      fileContext,
      '',
      'Before continuing, run the relevant validation command and report the exact output.',
      '',
      'Validation commands to run (use whichever apply to this project):',
      '- TypeScript type check: npm run typecheck (or npx tsc --noEmit)',
      '- Tests: npm test',
      '- Build: npm run build',
      '- Lint: npm run lint',
      '',
      'Report:',
      '1. The exact command you ran.',
      '2. The full output (not a summary).',
      '3. Whether it passed or failed.',
      '',
      'If it failed: fix only the reported error, then rerun the same command.',
      'Do not make any other changes until validation passes.',
    ].join('\n');
  }

  // CONTINUE
  return [
    `Continue with: "${input.taskTitle}"`,
    '',
    'Proceed with the smallest scoped change only.',
    '',
    'Constraints:',
    '- Touch only the files required for this specific change.',
    '- Do not refactor unrelated code.',
    '- Do not install new dependencies unless explicitly required by the task.',
    '- Do not run destructive commands without confirmation.',
    '',
    'After making your change:',
    '1. Run the relevant validation command (build, test, or typecheck).',
    '2. Report: files changed, commands run, exact validation output, any risks.',
  ].join('\n');
}
