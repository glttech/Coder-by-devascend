import { getRiskFlagDetails } from './riskAnalyzer';
import { getMissingEvidenceDetails } from './evidenceChecker';

export function parseLines(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function enrichSession(session: {
  riskFlags: string[];
  missingEvidence: string[];
  [key: string]: unknown;
}) {
  return {
    ...session,
    riskFlagDetails: getRiskFlagDetails(session.riskFlags),
    missingEvidenceDetails: getMissingEvidenceDetails(session.missingEvidence),
  };
}
