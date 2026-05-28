import React from 'react';

const ICONS: Record<string, string> = {
  CONTINUE:                 '✓',
  BLOCKED:                  '✕',
  SENIOR_APPROVAL_REQUIRED: '⚠',
  RUN_VALIDATION:           '◎',
  ASK_AGENT_FOR_EVIDENCE:   '?',
};

const LABELS: Record<string, string> = {
  CONTINUE:                 'Continue',
  BLOCKED:                  'Blocked — Do Not Proceed',
  SENIOR_APPROVAL_REQUIRED: 'Senior Approval Required',
  RUN_VALIDATION:           'Run Validation',
  ASK_AGENT_FOR_EVIDENCE:   'Ask Agent for Evidence',
};

interface DecisionBannerProps {
  decision: string;
  reason?: string | null;
  seniorApprovalRequired?: boolean;
}

export function DecisionBanner({ decision, reason, seniorApprovalRequired }: DecisionBannerProps) {
  const bannerClass = `decision-banner decision-banner-${decision}`;
  const icon = ICONS[decision] ?? '·';
  const label = LABELS[decision] ?? decision.replace(/_/g, ' ');

  return (
    <div>
      {seniorApprovalRequired && decision !== 'SENIOR_APPROVAL_REQUIRED' && (
        <div className="senior-approval-alert" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>⚠</span>
          <p className="senior-approval-alert-text">
            Senior Approval Required — Do not continue until a senior engineer reviews.
          </p>
        </div>
      )}
      <div className={bannerClass}>
        <span className="decision-banner-icon">{icon}</span>
        <div className="decision-banner-label">
          <div>{label}</div>
          {reason && <div className="decision-banner-reason">{reason}</div>}
        </div>
      </div>
    </div>
  );
}
