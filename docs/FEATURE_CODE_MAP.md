# Feature Code Map

Maps every major platform feature to the exact files that implement it.
Use this as the primary reference before editing any feature.

---

## Auth & Session

| Layer | File |
|---|---|
| Session type + getCurrentUser | `src/lib/session.ts` |
| RBAC requireRole | `src/lib/rbac.ts` |
| Auth guard (public paths) | `src/lib/authGuard.ts` |
| CSRF token | `src/lib/csrf.ts` |
| Login rate limit | `src/lib/loginRateLimit.ts` |
| Session store / revocation | `src/lib/sessionStore.ts`, `src/lib/sessionHelpers.ts` |
| Middleware (all auth enforcement) | `src/middleware.ts` |
| Login API | `src/app/api/auth/login/route.ts` |
| Logout API | `src/app/api/auth/logout/route.ts` |
| GitHub OAuth | `src/app/api/auth/github/route.ts`, `src/app/api/auth/github/callback/route.ts` |
| Me (current user) | `src/app/api/auth/me/route.ts` |
| CSRF token API | `src/app/api/auth/csrf/route.ts` |
| Login page | `src/app/login/page.tsx` |
| Register page | `src/app/register/page.tsx` |
| Session schema | `prisma/schema.prisma` → `ActiveSession` |
| Tests | `src/lib/__tests__/rbac.test.ts`, `authGuard.test.ts`, `session.test.ts`, `csrf.test.ts`, `loginRateLimit.test.ts`, `sessionRevocation.test.ts`, `sessionIdentity.test.ts` |

---

## Tasks

| Layer | File |
|---|---|
| Task list + create API | `src/app/api/tasks/route.ts` |
| Task detail + update API | `src/app/api/tasks/[id]/route.ts` |
| Task clone | `src/app/api/tasks/[id]/clone/route.ts` |
| Task bulk update | `src/app/api/tasks/bulk/route.ts` |
| Task export (CSV) | `src/app/api/tasks/export/route.ts` |
| Task sandbox | `src/app/api/tasks/[id]/sandbox/route.ts` |
| Task sandbox replay | `src/app/api/tasks/[id]/sandbox-replay/route.ts` |
| Task evidence | `src/app/api/tasks/[id]/evidence/route.ts` |
| Task policy eval | `src/app/api/tasks/[id]/policy/route.ts` |
| Task orchestrate | `src/app/api/tasks/[id]/orchestrate/route.ts` |
| Task report (HTML) | `src/app/api/tasks/[id]/report/route.ts` |
| Task PDF export | `src/app/api/tasks/[id]/pdf/route.ts` |
| Task comments | `src/app/api/tasks/[id]/comments/route.ts`, `[commentId]/route.ts` |
| Task list page | `src/app/tasks/page.tsx` |
| New task page | `src/app/tasks/new/page.tsx` |
| Task detail page | `src/app/tasks/[id]/page.tsx` |
| Task edit page | `src/app/tasks/[id]/edit/page.tsx` |
| Task report page | `src/app/tasks/[id]/report/page.tsx` |
| Task trace page | `src/app/tasks/[id]/trace/page.tsx` |
| Task evidence page | `src/app/tasks/[id]/evidence/page.tsx` |
| Task agents page | `src/app/tasks/[id]/agents/page.tsx` |
| Task sandbox replay page | `src/app/tasks/[id]/sandbox-replay/page.tsx` |
| Pagination helpers | `src/lib/pagination.ts` |
| Clone helper | `src/lib/taskClone.ts` |
| Schema | `prisma/schema.prisma` → `Task` |
| Tests | `src/lib/__tests__/tasksPagination.test.ts`, `sandboxRoute.test.ts`, `sandboxReplay.test.ts`, `taskClone.test.ts`, `bulk.test.ts`, `comments.test.ts` |

---

## Policy Gates & Governance

| Layer | File |
|---|---|
| Policy evaluation (main) | `src/lib/policyGates.ts` |
| Policy rule types + priority | `src/lib/policyRules.ts` |
| Decision engine | `src/lib/decisionEngine.ts` |
| Risk analyzer | `src/lib/riskAnalyzer.ts` |
| Evidence checker | `src/lib/evidenceChecker.ts` |
| Approval guard (state machine) | `src/lib/approvalGuard.ts` |
| Change control helpers | `src/lib/changeControlHelpers.ts` |
| Risk gate | `src/lib/riskGate.ts` |
| Dispatch gate | `src/lib/dispatchGate.ts` |
| Policy page | `src/app/policy/page.tsx` |
| Change control page | `src/app/change-control/page.tsx` |
| Policy settings page | `src/app/settings/policies/page.tsx` |
| Release checks | `src/lib/releaseChecks.ts`, `src/app/api/release-checks/route.ts`, `src/app/release-checks/page.tsx` |
| Tests | `src/lib/__tests__/policyGates.test.ts`, `policyRisk.test.ts`, `policyRules.test.ts`, `decisionEngine.test.ts`, `evidenceChecker.test.ts`, `approvalGuard.test.ts`, `approvalApprover.test.ts`, `riskAnalyzer.test.ts`, `riskAnalyzerFuzz.test.ts`, `riskGate.test.ts` |

---

## Approvals

| Layer | File |
|---|---|
| Approvals API | `src/app/api/approvals/route.ts` |
| Approval panel component | `src/components/ApprovalPanel.tsx` |
| Schema | `prisma/schema.prisma` → `Approval` |
| Tests | `src/lib/__tests__/approvalGuard.test.ts`, `approvalApprover.test.ts` |

---

## Agent Runs & Roles

| Layer | File |
|---|---|
| Agent runs list + create | `src/app/api/agent-runs/route.ts` |
| Agent run detail + update | `src/app/api/agent-runs/[id]/route.ts` |
| Run execution | `src/app/api/agent-runs/[id]/run/route.ts` |
| Run approval | `src/app/api/agent-runs/[id]/approve/route.ts` |
| Sandbox approval/rejection | `src/app/api/agent-runs/[id]/approve-sandbox/route.ts`, `reject-sandbox/route.ts` |
| Run evaluation | `src/app/api/agent-runs/evaluate/route.ts` |
| Run export | `src/app/api/agent-runs/export/route.ts` |
| Agent roles CRUD | `src/app/api/agent-roles/route.ts`, `[roleKey]/route.ts` |
| Provider scorecard | `src/app/api/agent-providers/scorecard/route.ts` |
| Role definitions (7 built-in) | `src/lib/agents/roles.ts` |
| Orchestrator | `src/lib/agents/orchestrator.ts` |
| Agent action guard | `src/lib/agentActionGuard.ts` |
| Orchestration helpers | `src/lib/orchestration.ts` |
| Run ingestion | `src/lib/runIngestion.ts` |
| Prompt builder | `src/lib/promptBuilder.ts` |
| Prompt evaluator | `src/lib/promptEvaluator.ts` |
| Prompt eval (validation) | `src/lib/promptEval.ts` |
| Next prompt generator | `src/lib/nextPromptGenerator.ts` |
| Sandbox planner | `src/lib/sandboxPlanner.ts` |
| Transcript parser | `src/lib/transcriptParser.ts` |
| Agent runs page | `src/app/agent-runs/page.tsx` |
| Agent run detail page | `src/app/agent-runs/[id]/page.tsx` |
| Agent roles page | `src/app/agent-roles/page.tsx` |
| Providers scorecard page | `src/app/providers/scorecard/page.tsx` |
| Schema | `prisma/schema.prisma` → `AgentRun`, `AgentStep`, `AgentRole`, `AgentProvider`, `Evaluation` |
| Tests | `src/lib/__tests__/agentRoles.test.ts`, `agentRoleViews.test.ts`, `agentActionGuard.test.ts`, `promptBuilder.test.ts`, `promptEval.test.ts`, `promptEvaluator.test.ts`, `nextPromptGenerator.test.ts`, `scorecard.test.ts` |

---

## Instructions & Operator Sessions

| Layer | File |
|---|---|
| Instructions CRUD | `src/app/api/instructions/route.ts`, `[id]/route.ts` |
| Instruction stale | `src/app/api/instructions/[id]/stale/route.ts` |
| Operator sessions CRUD | `src/app/api/operator-sessions/route.ts`, `[id]/route.ts` |
| Instruction page | `src/app/instructions/pending/page.tsx` |
| Schema | `prisma/schema.prisma` → `Instruction`, `OperatorSession` |
| Tests | `src/lib/__tests__/operatorSessionAuth.test.ts` |

---

## Projects & Milestones

| Layer | File |
|---|---|
| Projects CRUD | `src/app/api/projects/route.ts`, `[id]/route.ts` |
| Project intelligence | `src/app/api/projects/[id]/intelligence/route.ts` |
| Project governance timeline | `src/app/api/projects/[id]/governance-timeline/route.ts` |
| Project report | `src/app/api/projects/[id]/report/route.ts` |
| Milestones CRUD | `src/app/api/projects/[id]/milestones/route.ts`, `[milestoneId]/route.ts` |
| PR discovery | `src/app/api/projects/[id]/discover-prs/route.ts` |
| Project health | `src/lib/projectHealth.ts` |
| Project intelligence lib | `src/lib/projectIntelligence.ts` |
| Timeline builder | `src/lib/buildTimeline.ts` |
| Projects page | `src/app/projects/page.tsx` |
| Project board | `src/app/projects/[id]/board/page.tsx` |
| Project timeline | `src/app/projects/[id]/timeline/page.tsx` |
| Project governance timeline | `src/app/projects/[id]/governance-timeline/page.tsx` |
| Project intelligence page | `src/app/projects/[id]/intelligence/page.tsx` |
| Project risk page | `src/app/projects/[id]/risk/page.tsx` |
| Schema | `prisma/schema.prisma` → `Project`, `Milestone` |
| Tests | `src/lib/__tests__/buildTimeline.test.ts`, `governanceTimeline.test.ts`, `projectIntelligence.test.ts` |

---

## GitHub Integration & CI

| Layer | File |
|---|---|
| GitHub PR CRUD | `src/app/api/github-prs/route.ts`, `[id]/route.ts` |
| PR refresh | `src/app/api/github-prs/[id]/refresh/route.ts` |
| PR sync | `src/app/api/github-prs/sync/route.ts`, `sync/status/route.ts` |
| PR memory index | `src/app/api/github-prs/memory/route.ts` |
| CI status | `src/app/api/ci/status/route.ts` |
| GitHub client | `src/lib/githubClient.ts` |
| PR summary | `src/lib/prSummary.ts` |
| PR classifier | `src/lib/prClassifier.ts` |
| PR filters | `src/lib/prFilters.ts` |
| CI aggregation | `src/lib/ci/` |
| PR list page | `src/app/projects/[id]/prs/page.tsx` |
| PR import page | `src/app/projects/[id]/prs/import/page.tsx` |
| PR detail page | `src/app/projects/[id]/prs/[prId]/page.tsx` |
| CI dashboard | `src/app/ci/page.tsx` |
| Schema | `prisma/schema.prisma` → `GithubPR`, `PrSyncState`, `CiRun` |
| Tests | `src/lib/__tests__/githubClient.test.ts`, `githubPRRefresh.test.ts`, `prSummary.test.ts`, `prClassifier.test.ts` |

---

## Incidents (Coder Module)

| Layer | File |
|---|---|
| Incidents CRUD | `src/app/api/incidents/route.ts`, `[id]/route.ts` |
| Incident creation helper | `src/lib/incidents.ts` |
| Incident helpers | `src/lib/incidentHelpers.ts` |
| Incidents list page | `src/app/incidents/page.tsx` |
| Incident detail page | `src/app/incidents/[id]/page.tsx` |
| Postmortem page | `src/app/incidents/[id]/postmortem/page.tsx` |
| Schema | `prisma/schema.prisma` → `Incident` |
| Tests | `src/lib/__tests__/incidents.test.ts`, `incidentsApi.test.ts`, `incidentValidation.test.ts`, `incidentPostmortem.test.ts` |

---

## Audit, Traces & Evidence

| Layer | File |
|---|---|
| Audit writer | `src/lib/audit.ts` |
| Execution traces API | `src/app/api/traces/route.ts`, `[id]/route.ts`, `export/route.ts` |
| Audit export | `src/app/api/audit/export/route.ts` |
| Audit page | `src/app/audit/page.tsx` |
| Timeline component | `src/components/AuditTimeline.tsx` |
| Schema | `prisma/schema.prisma` → `AuditLog`, `ExecutionTrace`, `EvidenceChunk` |
| Tests | `src/lib/__tests__/auditEvents.test.ts`, `auditUserId.test.ts`, `buildTimeline.test.ts` |

---

## Reports & Exports

| Layer | File |
|---|---|
| Report template library | `src/lib/reportTemplates.ts` |
| PDF export button | `src/components/PdfExportButton.tsx` |
| Share links API | `src/app/api/share-links/route.ts`, `[id]/route.ts` |
| Share links helper | `src/lib/shareLinks.ts` |
| Public share page | `src/app/share/[token]/page.tsx` |
| Create share link component | `src/components/CreateShareLink.tsx` |
| Executive dashboard | `src/app/executive/page.tsx` |
| Schema | `prisma/schema.prisma` → `ShareLink` |
| Tests | `src/lib/__tests__/reportTemplates.test.ts`, `taskReport.test.ts`, `shareLinks.test.ts`, `executiveDashboard.test.ts` |

---

## Organizations, Teams & Invitations

| Layer | File |
|---|---|
| Orgs CRUD | `src/app/api/orgs/route.ts`, `[id]/members/route.ts`, `[id]/invites/route.ts` |
| Invite accept | `src/app/api/invite/[token]/route.ts` |
| Invitations helper | `src/lib/invites.ts` |
| Org scope helper | `src/lib/orgScope.ts` |
| Team settings page | `src/app/settings/team/page.tsx` |
| Invite accept page | `src/app/invite/[token]/page.tsx` |
| Schema | `prisma/schema.prisma` → `Organization`, `Membership`, `Invitation` |

---

## Webhooks

| Layer | File |
|---|---|
| Webhook CRUD | `src/app/api/webhooks/route.ts`, `[id]/route.ts` |
| Webhook delivery | `src/lib/webhookDelivery.ts` |
| Webhook settings page | `src/app/settings/webhooks/page.tsx` |
| Webhook manager component | `src/components/WebhookManager.tsx` |
| Schema | `prisma/schema.prisma` → `Webhook` |
| Tests | `src/lib/__tests__/webhookValidation.test.ts`, `webhookDelivery.test.ts` |

---

## API Keys & Rate Limiting

| Layer | File |
|---|---|
| API keys CRUD | `src/app/api/keys/route.ts`, `[id]/route.ts` |
| API key helper | `src/lib/apiKeys.ts` |
| Rate limiter | `src/lib/rateLimiter.ts` |
| API keys settings page | `src/app/settings/api-keys/page.tsx` |
| API key manager component | `src/components/ApiKeyManager.tsx` |
| Schema | `prisma/schema.prisma` → `ApiKey` |
| Tests | `src/lib/__tests__/rateLimiter.test.ts` |

---

## Notifications

| Layer | File |
|---|---|
| Notifications API | `src/app/api/notifications/route.ts`, `preferences/route.ts` |
| Notifications helper | `src/lib/notifications.ts` |
| Email (Resend stub) | `src/lib/email/` |
| Notification bell component | `src/components/NotificationBell.tsx` |
| Notification preferences page | `src/app/settings/notifications/page.tsx` |
| Schema | `prisma/schema.prisma` → `Notification`, `NotificationPreference` |

---

## Diagrams

| Layer | File |
|---|---|
| Diagram generator | `src/lib/diagrams/` |
| Diagram export | `src/app/api/diagrams/[id]/export/route.ts` |
| Diagrams gallery page | `src/app/diagrams/page.tsx` |
| Diagram export button | `src/components/DiagramExportButton.tsx` |
| Schema | `prisma/schema.prisma` → `Diagram` |

---

## Demo Mode

| Layer | File |
|---|---|
| Demo API | `src/app/api/demo/route.ts`, `reset/route.ts` |
| Demo seed (Coder) | `src/lib/demo/` |
| Demo page | `src/app/demo/page.tsx`, `[scenarioIndex]/page.tsx` |
| Showcase page | `src/app/showcase/page.tsx` |

---

## Shared UI Components

| Component | Purpose |
|---|---|
| `AppShell.tsx` | Root layout wrapper |
| `SidebarNav.tsx` | Primary navigation |
| `MobileNav.tsx`, `MobileSidebar.tsx` | Responsive nav |
| `ThemeToggle.tsx`, `ThemeScript.tsx` | Dark/light mode |
| `GlobalSearch.tsx` | Omni-search |
| `ApprovalPanel.tsx` | Approve/reject task |
| `OperatorPanel.tsx` | Operator session UI |
| `RunPromptPanel.tsx` | Manual prompt trigger |
| `AuditTimeline.tsx` | Event timeline visualization |
| `CiStatusGrid.tsx` | CI run matrix |
| `BulkTaskActions.tsx` | Bulk status/priority update |
| `NotificationBell.tsx` | Notification dropdown |
| `Card.tsx`, `Badge.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `DecisionBanner.tsx` | UI primitives |

---

## SOC Module (In Progress)

| Layer | Planned File |
|---|---|
| Security alert CRUD | `src/app/api/soc/alerts/route.ts`, `[id]/route.ts` |
| Alert ingest (manual) | `src/app/api/soc/alerts/ingest/manual/route.ts` |
| Alert ingest (Wazuh sample) | `src/app/api/soc/alerts/ingest/wazuh/route.ts` |
| Alert normalizer | `src/lib/soc/alertNormalizer.ts` |
| MITRE ATT&CK lookup | `src/lib/soc/mitre.ts` |
| Triage engine (deterministic) | `src/lib/soc/triageEngine.ts` |
| Severity scorer | `src/lib/soc/severityScorer.ts` |
| SOC report templates | `src/lib/soc/reportTemplates.ts` |
| SOC layout | `src/app/soc/layout.tsx` |
| SOC dashboard | `src/app/soc/dashboard/page.tsx` |
| Alert list | `src/app/soc/alerts/page.tsx` |
| Alert detail | `src/app/soc/alerts/[id]/page.tsx` |
| Triage queue | `src/app/soc/triage/page.tsx` |
| Incident list | `src/app/soc/incidents/page.tsx` |
| Incident detail | `src/app/soc/incidents/[id]/page.tsx` |
| Executive report | `src/app/soc/reports/executive/page.tsx` |
| SOC demo seed | `src/lib/demo/socSeed.ts` |
| Schema additions | `prisma/schema.prisma` → `SecurityAlert`, `Incident.module` |
| Tests | `src/lib/__tests__/soc/` (all SOC tests) |

---

*Last updated: 2026-06-20. Update this file whenever a new feature or route is added.*
