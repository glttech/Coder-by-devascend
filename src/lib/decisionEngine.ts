import type { RiskFlag } from './riskAnalyzer';
import type { MissingEvidence } from './evidenceChecker';

export type DecisionCode =
  | 'CONTINUE'
  | 'RUN_VALIDATION'
  | 'ASK_AGENT_FOR_EVIDENCE'
  | 'SENIOR_APPROVAL_REQUIRED'
  | 'BLOCKED';

export interface Decision {
  code: DecisionCode;
  seniorApprovalRequired: boolean;
  reason: string;
}

const BLOCKED_RISK_KEYS = new Set(['destructive-command', 'secrets-exposure']);

const SENIOR_APPROVAL_RISK_KEYS = new Set([
  'auth-security-change',
  'database-migration',
  'production-environment',
  'infra-docker-ci',
]);

export interface DecisionInput {
  riskFlags: RiskFlag[];
  missingEvidence: MissingEvidence[];
  filesMentioned: string[];
  commandsMentioned: string[];
  environment: string;
}

export function computeDecision(input: DecisionInput): Decision {
  const riskKeys = new Set(input.riskFlags.map((f) => f.key));
  const missingKeys = new Set(input.missingEvidence.map((e) => e.key));

  // BLOCKED: destructive commands — no conditions reduce this
  if (riskKeys.has('destructive-command')) {
    return {
      code: 'BLOCKED',
      seniorApprovalRequired: true,
      reason:
        'Destructive command detected in agent response. Stop immediately. A senior engineer must review before any further action.',
    };
  }

  // BLOCKED: secrets or API key exposure
  if (riskKeys.has('secrets-exposure')) {
    return {
      code: 'BLOCKED',
      seniorApprovalRequired: true,
      reason:
        'Potential secrets or API key exposure detected. Stop immediately, audit the response, and rotate any exposed credentials.',
    };
  }

  // BLOCKED: failed CI/build in production context
  if (riskKeys.has('failed-ci-build') && riskKeys.has('production-environment')) {
    return {
      code: 'BLOCKED',
      seniorApprovalRequired: true,
      reason:
        'Failed build or CI detected in a production context. Do not proceed. Senior approval required before any further action.',
    };
  }

  // SENIOR_APPROVAL_REQUIRED: high-risk areas
  const seniorRiskKeys = [...riskKeys].filter((k) => SENIOR_APPROVAL_RISK_KEYS.has(k));
  if (seniorRiskKeys.length > 0) {
    const labels = input.riskFlags
      .filter((f) => SENIOR_APPROVAL_RISK_KEYS.has(f.key))
      .map((f) => f.label)
      .join(', ');
    return {
      code: 'SENIOR_APPROVAL_REQUIRED',
      seniorApprovalRequired: true,
      reason: `High-risk areas detected: ${labels}. A senior engineer must review and approve before continuing.`,
    };
  }

  // ASK_AGENT_FOR_EVIDENCE: no response at all
  if (missingKeys.has('agent-response')) {
    return {
      code: 'ASK_AGENT_FOR_EVIDENCE',
      seniorApprovalRequired: false,
      reason:
        'No agent response has been recorded. Paste the agent output before the system can evaluate safety.',
    };
  }

  // ASK_AGENT_FOR_EVIDENCE: response present but no files and no commands
  if (missingKeys.has('files-changed') && missingKeys.has('commands-run')) {
    return {
      code: 'ASK_AGENT_FOR_EVIDENCE',
      seniorApprovalRequired: false,
      reason:
        'Agent response provided but no files changed or commands run were recorded. Ask the agent for an exact diff and command log.',
    };
  }

  // RUN_VALIDATION: files changed but no validation output
  if (input.filesMentioned.length > 0 && missingKeys.has('validation-output')) {
    return {
      code: 'RUN_VALIDATION',
      seniorApprovalRequired: false,
      reason:
        'Files were changed but no build, test, or CI output was provided. Run the relevant validation command before continuing.',
    };
  }

  // RUN_VALIDATION: failed build or test without production context
  if (riskKeys.has('failed-ci-build')) {
    return {
      code: 'RUN_VALIDATION',
      seniorApprovalRequired: false,
      reason:
        'A failed build or test was detected. Fix only the reported error and rerun the same validation command before continuing.',
    };
  }

  // CONTINUE: no blocking conditions, sufficient evidence
  return {
    code: 'CONTINUE',
    seniorApprovalRequired: false,
    reason:
      'No high-risk patterns detected and sufficient evidence provided. Safe to proceed with the smallest scoped change only.',
  };
}
