export interface SandboxPlan {
  plannedFiles: string[];        // files the agent would likely touch based on instruction
  plannedCommands: string[];     // commands it would run (npm test, git commit, etc.)
  estimatedRisk: 'low' | 'medium' | 'high';
  warnings: string[];            // any concerns about the plan
  requiresApproval: boolean;
  summary: string;               // 1–2 sentence plain English description
}

export function generateSandboxPlan(input: {
  instruction: string;
  riskLevel: string;
  environment: string;
  agentTool: string;
}): SandboxPlan {
  // Pattern-match the instruction to generate a plausible (not real) plan
  // This is purely static analysis — NO live execution

  const plannedFiles: string[] = [];
  const plannedCommands: string[] = ['npm run typecheck', 'npm test'];
  const warnings: string[] = [];

  // Extract likely file paths mentioned in instruction
  // Note: tsx/jsx must come before ts/js in the alternation to avoid early match.
  const fileMatches = input.instruction.match(/src\/[\w/.-]+\.(tsx|ts|jsx|js|css)/g) || [];
  plannedFiles.push(...fileMatches);

  if (input.instruction.toLowerCase().includes('migration')) {
    plannedFiles.push('prisma/migrations/[new]/migration.sql');
    plannedCommands.push('prisma migrate dev');
    warnings.push('Schema migration detected — review carefully before executing');
  }

  if (input.instruction.toLowerCase().includes('install')) {
    plannedCommands.push('npm install [package]');
    warnings.push('New package installation — verify package safety');
  }

  if (input.environment === 'production') {
    warnings.push('Production environment targeted — requires senior approval');
  }

  return {
    plannedFiles: plannedFiles.length > 0 ? plannedFiles : ['(files to be determined by agent)'],
    plannedCommands,
    estimatedRisk: input.riskLevel as 'low' | 'medium' | 'high',
    warnings,
    requiresApproval: input.riskLevel === 'high' || input.environment === 'production',
    summary: `Agent "${input.agentTool}" will execute the requested change in ${input.environment} environment with ${input.riskLevel} risk.`,
  };
}
