type PRRow = {
  id: string;
  projectId: string;
  prNumber: number;
  title: string;
  ciStatus: string | null;
  state: string;
  merged: boolean;
  prUrl: string | null;
};

export type ProjectCiHealth = {
  projectId: string;
  projectName: string;
  total: number;
  success: number;
  failure: number;
  pending: number;
  unknown: number;
  signal: 'green' | 'yellow' | 'red' | 'none';
};

export function aggregateProjectCi(projectName: string, projectId: string, prs: PRRow[]): ProjectCiHealth {
  const open = prs.filter(p => !p.merged && p.state === 'open');
  const total = open.length;
  const success = open.filter(p => p.ciStatus === 'success').length;
  const failure = open.filter(p => p.ciStatus === 'failure').length;
  const pending = open.filter(p => p.ciStatus === 'pending').length;
  const unknown = total - success - failure - pending;

  let signal: ProjectCiHealth['signal'] = 'none';
  if (total > 0) {
    if (failure > 0) signal = 'red';
    else if (pending > 0) signal = 'yellow';
    else if (success > 0) signal = 'green';
    else signal = 'yellow';
  }

  return { projectId, projectName, total, success, failure, pending, unknown, signal };
}
