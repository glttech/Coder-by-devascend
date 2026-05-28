import React from 'react';

// Maps known keys to CSS badge variant classes defined in globals.css
const STATUS_CLASS: Record<string, string> = {
  draft:            'badge-draft',
  pending_approval: 'badge-pending_approval',
  approved:         'badge-approved',
  executing:        'badge-executing',
  completed:        'badge-completed',
  blocked:          'badge-blocked',
};

const RISK_CLASS: Record<string, string> = {
  low:      'badge-risk-low',
  medium:   'badge-risk-medium',
  high:     'badge-risk-high',
  critical: 'badge-risk-critical',
};

const SEV_CLASS: Record<string, string> = {
  critical: 'badge-sev-critical',
  high:     'badge-sev-high',
  medium:   'badge-sev-medium',
  low:      'badge-sev-low',
};

const DECISION_CLASS: Record<string, string> = {
  CONTINUE:                 'badge-CONTINUE',
  RUN_VALIDATION:           'badge-RUN_VALIDATION',
  ASK_AGENT_FOR_EVIDENCE:   'badge-ASK_AGENT_FOR_EVIDENCE',
  SENIOR_APPROVAL_REQUIRED: 'badge-SENIOR_APPROVAL_REQUIRED',
  BLOCKED:                  'badge-BLOCKED',
};

const EVENT_CLASS: Record<string, string> = {
  instruction_created:        'badge-event-instruction_created',
  instruction_status_changed: 'badge-event-instruction_status_changed',
  operator_session_created:   'badge-event-operator_session_created',
  operator_session_updated:   'badge-event-operator_session_updated',
};

const ENV_CLASS: Record<string, string> = {
  local:      'badge-env-local',
  dev:        'badge-env-dev',
  staging:    'badge-env-staging',
  production: 'badge-env-production',
};

interface BadgeProps {
  text: string;
  variant?: 'status' | 'risk' | 'severity' | 'decision' | 'event' | 'env' | 'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'purple';
  className?: string;
}

export function Badge({ text, variant, className }: BadgeProps) {
  let variantClass = 'badge-neutral';

  if (variant === 'status')   variantClass = STATUS_CLASS[text]   ?? 'badge-neutral';
  else if (variant === 'risk')      variantClass = RISK_CLASS[text]     ?? 'badge-neutral';
  else if (variant === 'severity')  variantClass = SEV_CLASS[text]      ?? 'badge-neutral';
  else if (variant === 'decision')  variantClass = DECISION_CLASS[text] ?? 'badge-neutral';
  else if (variant === 'event')     variantClass = EVENT_CLASS[text]    ?? 'badge-neutral';
  else if (variant === 'env')       variantClass = ENV_CLASS[text]      ?? 'badge-neutral';
  else if (variant)                 variantClass = `badge-${variant}`;

  const label = text.replace(/_/g, ' ');
  return (
    <span className={`badge ${variantClass}${className ? ` ${className}` : ''}`}>
      {label}
    </span>
  );
}

// Convenience wrappers
export function StatusBadge({ status }: { status: string }) {
  return <Badge text={status} variant="status" />;
}

export function RiskBadge({ level }: { level: string }) {
  return <Badge text={level} variant="risk" />;
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge text={severity.toUpperCase()} variant="severity" />;
}

export function DecisionBadge({ decision }: { decision: string }) {
  return <Badge text={decision} variant="decision" />;
}

export function EventBadge({ event }: { event: string }) {
  return <Badge text={event} variant="event" />;
}

export function EnvBadge({ env }: { env: string }) {
  return <Badge text={env} variant="env" />;
}
