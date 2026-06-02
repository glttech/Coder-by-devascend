# End-to-End Architecture

## Control Room Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CODER BY DEVASCEND — CONTROL ROOM                 │
│                                                                      │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────┐   │
│  │   Dashboard    │   │  Task Manager  │   │  Instruction Queue │   │
│  │  (overview,    │   │  (create,      │   │  (pending_approval,│   │
│  │  health, runs) │   │  list, detail) │   │  blocked, stale)   │   │
│  └────────────────┘   └────────────────┘   └────────────────────┘   │
│                                                                      │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────┐   │
│  │ Prompt Builder │   │ Operator Panel │   │   Audit Log        │   │
│  │  (structured   │   │  (risk flags,  │   │  (immutable event  │   │
│  │  safe prompts) │   │  decisions,    │   │   trail)           │   │
│  │                │   │  next prompt)  │   │                    │   │
│  └────────────────┘   └────────────────┘   └────────────────────┘   │
│                                                                      │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────┐   │
│  │ Approval Gate  │   │ Evidence       │   │  Project Registry  │   │
│  │  (atomic,      │   │  Report        │   │  (repos, branches, │   │
│  │  race-safe)    │   │  (per-task)    │   │   commands, policy)│   │
│  └────────────────┘   └────────────────┘   └────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                │                       │
         ┌──────▼──────┐         ┌──────▼──────┐
         │  PostgreSQL  │         │  GitHub API  │  (Phase 2+)
         │  (Prisma)   │         │  (REST/GQL)  │
         └─────────────┘         └─────────────┘
```

---

## GitHub Integration Architecture (Phase 2 Target)

```
┌───────────────────────────────────────────────────────────┐
│                   GITHUB INTEGRATION                       │
│                                                           │
│  Project Registry                                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │  repoOwner / repoName                            │    │
│  │  defaultBranch / devBranch                       │    │
│  │  githubInstallationId (GitHub App)               │    │
│  └──────────────────────────────────────────────────┘    │
│                       │                                   │
│         ┌─────────────┼──────────────┐                   │
│         ▼             ▼              ▼                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐           │
│  │  PR      │  │  Commit  │  │  CI Status   │           │
│  │  Reader  │  │  Diff    │  │  Poller      │           │
│  │          │  │  Fetcher │  │              │           │
│  └──────────┘  └──────────┘  └──────────────┘           │
│       │               │              │                   │
│       └───────────────┴──────────────┘                   │
│                       │                                   │
│               ┌───────▼────────┐                         │
│               │ AgentRun       │                         │
│               │ Auto-Populate  │                         │
│               │ (filesChanged, │                         │
│               │  commitHash,   │                         │
│               │  testResult,   │                         │
│               │  ciStatus)     │                         │
│               └────────────────┘                         │
│                                                           │
│  Webhook Receiver: POST /api/webhooks/github              │
│  Events: pull_request, check_run, push                   │
└───────────────────────────────────────────────────────────┘
```

**GitHub App scopes needed (Phase 2):**
- `contents:read` — diff/file reading
- `pull_requests:read` — PR metadata
- `checks:read` — CI status
- `statuses:read` — commit status

**No write scopes needed in Phase 2.** Write scopes (PR approval, merge) require Phase 5 governance.

---

## Agent Execution Architecture (Phase 2–4 Target)

```
Phase 1 (current):
  Rahul → copy prompt → paste into Claude Code → copy response → paste into UI

Phase 2 (GitHub-aware):
  Task created → prompt generated → Rahul dispatches manually
  → GitHub PR created by agent → webhook fires
  → AgentRun auto-populated from PR diff + CI status
  → Decision computed automatically

Phase 3 (semi-autonomous):
  Task created → Operator Session auto-opened
  → Decision engine routes:
    ┌─────────────────────────────────────────────────────────┐
    │                  DECISION ROUTING                        │
    │                                                         │
    │  CONTINUE         → auto-approve (if policy allows)    │
    │  RUN_VALIDATION   → trigger CI re-run                  │
    │  ASK_EVIDENCE     → request more info from agent       │
    │  SENIOR_APPROVAL  → queue for Rahul review             │
    │  BLOCKED          → halt, notify Rahul                 │
    └─────────────────────────────────────────────────────────┘

Phase 4 (sub-agent workflow):
  CEO agent receives high-level task
  → Decomposes into sub-tasks
  → Routes to sub-agents:
      CTO agent    → implementation tasks
      CISO agent   → security review tasks
      QA agent     → test generation tasks
      DevOps agent → deployment tasks
      Docs agent   → documentation tasks
  → Each sub-agent runs under its role policy
  → Exceptions bubble up to Rahul
```

---

## DEV Server / Container Validation Architecture (Phase 3 Target)

```
Project Registry (Phase 3 fields):
  devServerUrl: "http://localhost:3001"
  healthEndpoint: "/health"
  containerName: "my-app-dev"
  deployCommand: "docker-compose up -d --build"
  testCommand: "npm test"
  buildCommand: "npm run build"

Post-Approval Validation Flow:
  Approval.approved = true
         │
         ▼
  Run deployCommand (in sandboxed env, never production)
         │
         ▼
  Poll healthEndpoint (up to 30s timeout)
         │
    ┌────┴────┐
    │         │
  UP         DOWN
    │         │
  Record     Flag as
  "deploy    validation
  validated" FAILED
         │
         ▼
  Capture docker logs (last 100 lines) → store in AgentRun.testResult
```

**Constraint:** deployCommand is ONLY executed in `environment = 'local'` or `environment = 'dev'`. Any attempt to run for `staging` or `production` tasks is blocked at the API layer.

---

## Audit / Evidence Architecture

```
Every write operation emits an AuditLog entry:

┌────────────────────────────────────────────────────────────┐
│                     AUDIT LOG                              │
│                                                            │
│  Events:                                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ instruction_created          → taskId, instructionId │ │
│  │ instruction_status_changed   → from, to, metadata    │ │
│  │ operator_session_created     → decision, risk count  │ │
│  │ operator_session_updated     → decision, step        │ │
│  │ task_approval_decided        → approved, taskId      │ │
│  │ [Phase 2] pr_evidence_imported → prNumber, sha       │ │
│  │ [Phase 2] ci_result_received   → status, checks      │ │
│  │ [Phase 3] dev_deploy_validated → container, health   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Immutability: AuditLog has no UPDATE or DELETE routes.    │
│  Records are append-only.                                  │
│                                                            │
│  Evidence chain per task:                                  │
│  Task → AgentRun (with filesChanged, commitHash)          │
│       → Evaluation[] (per heuristic check)                │
│       → OperatorSession[] (risk flags, decisions)         │
│       → Instruction[] (approval workflow)                 │
│       → AuditLog[] (every transition timestamped)         │
└────────────────────────────────────────────────────────────┘
```

---

## Approval / Risk Gate Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   APPROVAL GATE                              │
│                                                              │
│  Layer 1: Task-level approval (existing)                    │
│    Task.approvalRequired = true                             │
│    → ApprovalPanel shown on task detail                     │
│    → POST /api/approvals enforces state machine             │
│    → Atomic write (P2002 + conditional updateMany)          │
│    → AuditLog on decision                                   │
│                                                              │
│  Layer 2: Instruction-level approval (existing)             │
│    Instruction.status = 'pending_approval'                  │
│    → Queue at /instructions/pending                         │
│    → PATCH /api/instructions/[id] with status='approved'    │
│    → State machine enforces valid transitions               │
│    → AuditLog on every transition                           │
│                                                              │
│  Layer 3: Risk gate (existing — operator session)           │
│    OperatorSession.recommendedAction                        │
│    → BLOCKED: hard stop, cannot proceed                     │
│    → SENIOR_APPROVAL_REQUIRED: queue for Rahul review       │
│    → CONTINUE: proceed with next prompt                     │
│                                                              │
│  Layer 4: Auto-approve policy (Phase 4)                     │
│    AutoApprovePolicy.allowedDecisions = ['CONTINUE']        │
│    AutoApprovePolicy.allowedEnvironments = ['local', 'dev'] │
│    AutoApprovePolicy.maxRiskLevel = 'low'                   │
│    AutoApprovePolicy.requireCIGreen = true                  │
│    → If all conditions met: auto-approve without Rahul      │
│    → Else: queue for Rahul review                           │
│                                                              │
│  Red lines (never auto-approve, regardless of policy):      │
│    - environment = 'production'                             │
│    - riskFlags includes 'secrets-exposure'                  │
│    - riskFlags includes 'destructive-command'               │
│    - riskFlags includes 'database-migration'                │
│    - instruction involves auth or CISO-flagged changes      │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Registry Architecture (Phase 2 Target Schema)

```
Model ProjectConfig {
  id                 String   (UUID)
  projectId          String   (FK → Project)

  // GitHub
  repoOwner          String
  repoName           String
  defaultBranch      String   @default("main")
  devBranch          String   @default("dev")
  githubAppInstallId String?

  // Local paths
  localPath          String?  // absolute path on operator machine
  containerName      String?  // docker container name for DEV

  // Commands (run in local/dev only, NEVER production)
  testCommand        String?  @default("npm test")
  buildCommand       String?  @default("npm run build")
  deployCommand      String?  // e.g. "docker-compose up -d --build"
  healthEndpoint     String?  // e.g. "http://localhost:3000/health"

  // Policy
  autonomyLevel      String   @default("manual")  // manual | semi | auto
  maxAutoRiskLevel   String   @default("low")      // low | medium
  allowedAutoEnvs    String[] @default(["local", "dev"])
  
  // Owner
  ownerUserId        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

---

## Sequence Flow: Task Creation → PR Merge → DEV Deploy

### Phase 1 (current — fully manual)

```
Rahul                    Orchestrator              External
  │                           │
  │── Create task ──────────► │ POST /api/tasks
  │                           │ → Task created (pending)
  │                           │
  │◄─ View generated prompt ──│ buildPrompt(task)
  │                           │
  │── [copy prompt] ─────────►│ (manual clipboard)
  │       │                   │
  │   Claude Code             │
  │   OpenClaw                │
  │   Codex                   │
  │       │                   │
  │◄──── agent output ────────│ (manual paste-in)
  │                           │
  │── Submit agent run ──────►│ POST /api/runs
  │                           │ → AgentRun created
  │                           │ → 8 evaluations computed
  │                           │
  │── Create operator session►│ POST /api/operator-sessions
  │                           │ → riskFlags computed
  │                           │ → decision computed
  │                           │ → nextPrompt generated
  │                           │
  │◄─ Decision: CONTINUE ─────│
  │                           │
  │── Approve task ──────────►│ POST /api/approvals
  │                           │ → Approval recorded
  │                           │ → AuditLog entry
  │                           │
  │── Transition instruction ►│ PATCH /api/instructions/[id]
  │   (approved → executing   │ → Status transitioned
  │   → completed)            │ → AuditLog entries
  │                           │
  │   [Rahul manually         │
  │    checks GitHub,         │
  │    merges PR,             │
  │    deploys to DEV]        │
```

### Phase 2 (GitHub-aware — target)

```
Rahul                    Orchestrator              GitHub
  │── Create task ──────────►│                        │
  │                          │── register webhook ───►│
  │◄─ prompt generated ──────│                        │
  │── dispatch to agent ────►│                        │
  │                          │                   agent creates PR
  │                          │◄─── PR opened ─────────│
  │                          │── import PR evidence ──►│
  │                          │   (files, diff, SHA)    │
  │                          │                        │
  │                          │◄─── CI status ──────────│
  │                          │── compute decision      │
  │                          │                        │
  │◄─ notification ──────────│ (if not CONTINUE)      │
  │── review + approve ─────►│                        │
  │                          │── merge PR ────────────►│
  │                          │   (if policy allows)    │
```

### Phase 3 (DEV deployment-aware — target)

```
[After Phase 2 approval]
  Orchestrator              DEV Server
       │── run deployCommand──►│
       │── poll healthEndpoint►│
       │◄─ 200 OK ─────────────│
       │── capture logs ───────│
       │                       │
       │ → AgentRun.testResult populated
       │ → AuditLog: dev_deploy_validated
       │ → Task status: completed
```
