/**
 * Competitive Feature Matrix — static definitions for competitors and feature keys.
 * The matrix is persisted in CompetitorFeature rows; these are the display labels.
 */

export const COMPETITORS = [
  'Coder',
  'GitHub Copilot',
  'OpenAI Codex',
  'Gemini Code Assist',
  'Claude Code',
  'OpenClaw',
] as const;

export type Competitor = (typeof COMPETITORS)[number];

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
}

export const FEATURE_DEFS: FeatureDef[] = [
  { key: 'pr_memory',       label: 'PR Memory',        description: 'Index and search past pull requests' },
  { key: 'audit_trail',     label: 'Audit Trail',      description: 'Tamper-evident log of all admin actions' },
  { key: 'approval_gates',  label: 'Approval Gates',   description: 'Human sign-off required before agent proceeds' },
  { key: 'evidence_pack',   label: 'Evidence Pack',    description: 'Auto-generated proof bundle for releases' },
  { key: 'incident_mode',   label: 'Incident Mode',    description: 'Structured incident response and post-mortem' },
  { key: 'org_rbac',        label: 'Org RBAC',         description: 'Role-based access control across org/project' },
  { key: 'api_keys',        label: 'API Keys',         description: 'Scoped API key management for integrations' },
  { key: 'reports',         label: 'Reports',          description: 'Release intelligence and timeline reports' },
  { key: 'agent_execution', label: 'Agent Execution',  description: 'Run multi-step AI agents with tool use' },
  { key: 'sandbox_preview', label: 'Sandbox Preview',  description: 'Isolated preview environment per task/PR' },
];

export const FEATURE_KEYS = FEATURE_DEFS.map((f) => f.key);

export type MatrixStatus = 'yes' | 'no' | 'partial' | 'unknown';
export const VALID_STATUSES: MatrixStatus[] = ['yes', 'no', 'partial', 'unknown'];

export const STATUS_CONFIG: Record<MatrixStatus, { label: string; color: string; bg: string }> = {
  yes:     { label: 'Yes',     color: 'var(--green)',       bg: 'color-mix(in srgb, var(--green) 12%, transparent)' },
  partial: { label: 'Partial', color: 'var(--amber)',       bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  no:      { label: 'No',      color: 'var(--red)',         bg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
  unknown: { label: '?',       color: 'var(--text-muted)',  bg: 'var(--surface-2)' },
};

export interface MatrixRow {
  featureKey: string;
  featureLabel: string;
  featureDescription: string;
  cells: Record<string, { status: MatrixStatus; notes: string | null }>;
}

/**
 * Build a display matrix from a flat list of CompetitorFeature records.
 */
export function buildMatrix(
  records: Array<{ competitor: string; featureKey: string; status: string; notes: string | null }>,
): MatrixRow[] {
  const lookup = new Map<string, { status: MatrixStatus; notes: string | null }>();
  for (const r of records) {
    lookup.set(`${r.competitor}::${r.featureKey}`, {
      status: (VALID_STATUSES.includes(r.status as MatrixStatus) ? r.status : 'unknown') as MatrixStatus,
      notes: r.notes,
    });
  }

  return FEATURE_DEFS.map((fd) => ({
    featureKey: fd.key,
    featureLabel: fd.label,
    featureDescription: fd.description,
    cells: Object.fromEntries(
      COMPETITORS.map((c) => [
        c,
        lookup.get(`${c}::${fd.key}`) ?? { status: 'unknown' as MatrixStatus, notes: null },
      ]),
    ),
  }));
}
