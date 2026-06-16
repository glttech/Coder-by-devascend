interface ProjectData {
  id: string;
  name: string;
  repoOwner: string | null;
  repoName: string | null;
  tasks: Array<{ id: string; status: string; environment: string }>;
}

export function generateArchitectureDiagram(project: ProjectData): string {
  const repoLabel = project.repoOwner && project.repoName
    ? `${project.repoOwner}/${project.repoName}`
    : 'repository';

  const envCounts: Record<string, number> = {};
  for (const t of project.tasks) {
    envCounts[t.environment] = (envCounts[t.environment] ?? 0) + 1;
  }

  const lines = [
    'graph TD',
    `  P["📁 ${escapeLabel(project.name)}"]`,
    `  R["🔗 ${escapeLabel(repoLabel)}"]`,
    '  P --> R',
  ];

  for (const [env, count] of Object.entries(envCounts)) {
    const nodeId = `ENV_${env.toUpperCase()}`;
    lines.push(`  ${nodeId}["${env} (${count} tasks)"]`);
    lines.push(`  P --> ${nodeId}`);
  }

  const done = project.tasks.filter(t => t.status === 'completed').length;
  const total = project.tasks.length;
  if (total > 0) {
    lines.push(`  STATS["✓ ${done}/${total} tasks completed"]`);
    lines.push('  P --> STATS');
  }

  return lines.join('\n');
}

function escapeLabel(s: string): string {
  return s.replace(/"/g, "'").replace(/[<>]/g, '');
}
