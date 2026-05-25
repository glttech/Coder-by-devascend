export interface MissingEvidence {
  key: string;
  label: string;
  description: string;
}

export interface EvidenceInput {
  agentResponse: string | null | undefined;
  filesMentioned: string[];
  commandsMentioned: string[];
  validationOutput: string | null | undefined;
  reviewerNotes: string | null | undefined;
}

function hasContent(value: string | null | undefined, minLength = 5): boolean {
  return typeof value === 'string' && value.trim().length >= minLength;
}

export function checkMissingEvidence(input: EvidenceInput): MissingEvidence[] {
  const missing: MissingEvidence[] = [];

  if (!hasContent(input.agentResponse, 10)) {
    missing.push({
      key: 'agent-response',
      label: 'Agent response missing',
      description: 'No agent response has been recorded. Paste the full agent output to enable analysis.',
    });
  }

  if (!input.filesMentioned || input.filesMentioned.length === 0) {
    missing.push({
      key: 'files-changed',
      label: 'Files changed missing',
      description: 'No files were listed as changed or mentioned by the agent.',
    });
  }

  if (!input.commandsMentioned || input.commandsMentioned.length === 0) {
    missing.push({
      key: 'commands-run',
      label: 'Commands run missing',
      description: 'No commands were reported as run. Record every command the agent executed.',
    });
  }

  if (!hasContent(input.validationOutput)) {
    missing.push({
      key: 'validation-output',
      label: 'Validation output missing',
      description: 'No build, test, lint, or CI output was provided. Run the relevant validation command.',
    });
  }

  if (!hasContent(input.reviewerNotes)) {
    missing.push({
      key: 'reviewer-notes',
      label: 'Operator reviewer notes missing',
      description: 'No operator notes recorded. Add context, concerns, or observations about this run.',
    });
  }

  return missing;
}

export function getMissingEvidenceDetails(keys: string[]): MissingEvidence[] {
  const ALL: MissingEvidence[] = [
    { key: 'agent-response', label: 'Agent response missing', description: 'No agent response has been recorded.' },
    { key: 'files-changed', label: 'Files changed missing', description: 'No files were listed as changed or mentioned.' },
    { key: 'commands-run', label: 'Commands run missing', description: 'No commands were reported as run.' },
    { key: 'validation-output', label: 'Validation output missing', description: 'No build, test, or CI output was provided.' },
    { key: 'reviewer-notes', label: 'Operator reviewer notes missing', description: 'No operator notes recorded.' },
  ];
  return keys.flatMap((key) => {
    const item = ALL.find((e) => e.key === key);
    return item ? [item] : [];
  });
}
