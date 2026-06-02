# Projects Registry Specification

## Purpose

The Project Registry is the source of truth for every repository the orchestrator manages. It answers: "What is this project, where does it live, how do I build/test/deploy it, and what risks are allowed?"

In Phase 1, the `Project` model is a stub (just `id` and `name`). This spec defines the full target schema for Phase 2+.

---

## Required Metadata Per Project

### Identity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Internal identifier |
| `name` | String | Yes | Human-readable name (e.g., "Coder by DevAscend") |
| `description` | String | No | Short description of what this project does |
| `ownerUserId` | UUID | No | FK to User — who is responsible for this project |
| `createdAt` | DateTime | Yes | Auto |
| `updatedAt` | DateTime | Yes | Auto |

---

### GitHub Integration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repoOwner` | String | Yes | GitHub org or username (e.g., "glttech") |
| `repoName` | String | Yes | Repository name (e.g., "Coder-by-devascend") |
| `defaultBranch` | String | Yes | Protected main branch (e.g., "main") |
| `devBranch` | String | No | Active development branch (e.g., "dev") |
| `githubAppInstallId` | String | No | GitHub App installation ID for token scoping |
| `webhookSecret` | String | No | HMAC secret for validating incoming webhooks — store encrypted, never log |

**Notes:**
- `webhookSecret` must never appear in logs, audit records, or diff output
- GitHub token scope: `contents:read, pull_requests:read, checks:read` (read-only in Phase 2)

---

### Local / Container Paths

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `localPath` | String | No | Absolute local filesystem path (e.g., "/home/rahul/projects/my-app") |
| `containerName` | String | No | Docker container name for DEV (e.g., "my-app-dev") |
| `dockerComposePath` | String | No | Path to docker-compose.yml (e.g., "./docker-compose.dev.yml") |

---

### Commands

All commands run ONLY in `local` or `dev` environments. Any attempt to execute for `staging` or `production` is blocked at the API layer.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `testCommand` | String | `npm test` | Run test suite |
| `buildCommand` | String | `npm run build` | Build the project |
| `lintCommand` | String | `npm run lint` | Lint check |
| `typecheckCommand` | String | `npm run typecheck` | TypeScript check |
| `deployCommand` | String | None | DEV deploy (e.g., "docker-compose up -d --build") |
| `healthEndpoint` | String | None | URL to poll after deploy (e.g., "http://localhost:3001/health") |
| `healthTimeoutSeconds` | Int | 30 | Max seconds to wait for health endpoint to return 200 |

**Command execution rules:**
- Commands are shell-escaped before execution
- No dynamic interpolation of user-supplied strings into commands
- All command stdout/stderr captured and stored — never streamed to client
- Max execution timeout: 120 seconds for any command
- Commands run as the orchestrator process user (not root)

---

### Autonomy Policy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autonomyLevel` | Enum | `manual` | `manual` / `semi` / `auto` |
| `allowedAutoEnvironments` | String[] | `["local", "dev"]` | Environments where auto-approve can operate |
| `maxAutoRiskLevel` | Enum | `low` | Max risk level for auto-approval: `low` / `medium` |
| `requireCIGreen` | Boolean | `true` | Auto-approve requires all CI checks to pass |
| `requireDevValidated` | Boolean | `false` | Auto-approve requires DEV health check to pass |
| `autoMergeEnabled` | Boolean | `false` | Whether approved PRs are auto-merged (Phase 4+) |

**`autonomyLevel` meanings:**
- `manual` — Rahul approves every task. No automation.
- `semi` — Decision engine computes recommendation; Rahul still clicks approve.
- `auto` — Tasks meeting all autonomy policy conditions are approved without Rahul click.

---

### Red-Line Rules

Red lines are absolute blocks that override the autonomy policy and cannot be overridden.

| Rule | Trigger | Block |
|------|---------|-------|
| No production automation | `environment = 'production'` | Always stop, always require Rahul |
| No staging auto-approve | `environment = 'staging'` | Always stop unless Rahul explicitly enables |
| No secrets in diff | `riskFlags includes 'secrets-exposure'` | Block unconditionally |
| No destructive commands | `riskFlags includes 'destructive-command'` | Block unconditionally |
| No database migrations | `riskFlags includes 'database-migration'` | Require separate migration approval |
| No auth changes without CISO review | `riskFlags includes 'auth-security-change'` | Require senior approval |

```
redLineRules: String[]
// Values: ["no-production", "no-staging-auto", "no-secrets-in-diff",
//          "no-destructive-commands", "no-db-migration-auto",
//          "no-auth-auto"]
```

---

### Environment Definitions

Each project can define named environments with specific risk profiles:

```
Model ProjectEnvironment {
  id                 UUID
  projectId          UUID  (FK)
  name               String   // "local", "dev", "staging", "production"
  serverUrl          String?  // URL to reach this environment
  isProtected        Boolean  // true = never auto-deploy
  requiresApproval   Boolean  // true = any task in this env requires approval
  deployCommand      String?  // override default per-environment
  healthEndpoint     String?  // override default per-environment
}
```

---

### Validation Checklist (per project, per task)

Before any task is auto-approved or marked complete, the following must be confirmed. Each item is a boolean field that the decision engine checks:

| Check | Condition |
|-------|-----------|
| CI passed | All check_runs in the PR are `conclusion: success` |
| Build clean | buildCommand exits 0 |
| Tests passing | testCommand exits 0 |
| Typecheck clean | typecheckCommand exits 0 |
| No secrets in diff | 0 secrets-exposure risk flags |
| No destructive commands | 0 destructive-command risk flags |
| DEV health OK | healthEndpoint returned 200 (if devBranch deployed) |
| Reviewer notes present | OperatorSession.reviewerNotes is non-empty |
| Approval recorded | Approval.approved = true |
| All instructions complete | All Instruction.status = 'completed' |

---

## Phase 2 Schema (Prisma)

```prisma
model ProjectConfig {
  id                     String    @id @default(uuid())
  projectId              String    @unique
  project                Project   @relation(fields: [projectId], references: [id])

  // GitHub
  repoOwner              String
  repoName               String
  defaultBranch          String    @default("main")
  devBranch              String?
  githubAppInstallId     String?

  // Local
  localPath              String?
  containerName          String?
  dockerComposePath      String?

  // Commands
  testCommand            String?
  buildCommand           String?
  lintCommand            String?
  typecheckCommand       String?
  deployCommand          String?
  healthEndpoint         String?
  healthTimeoutSeconds   Int       @default(30)

  // Autonomy
  autonomyLevel          String    @default("manual")
  allowedAutoEnvs        String[]  @default(["local", "dev"])
  maxAutoRiskLevel       String    @default("low")
  requireCIGreen         Boolean   @default(true)
  requireDevValidated    Boolean   @default(false)
  autoMergeEnabled       Boolean   @default(false)
  redLineRules           String[]  @default([])

  // Owner
  ownerUserId            String?

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}
```

---

## Example: Coder by DevAscend Project Config

```json
{
  "name": "Coder by DevAscend",
  "repoOwner": "glttech",
  "repoName": "Coder-by-devascend",
  "defaultBranch": "main",
  "devBranch": "claude/setup-coder-repo-XFuyw",
  "localPath": "/home/user/Coder-by-devascend",
  "containerName": "coder-db",
  "testCommand": "./node_modules/.bin/tsx --test 'src/lib/__tests__/**/*.test.ts'",
  "buildCommand": "npm run build",
  "lintCommand": "npm run lint",
  "typecheckCommand": "npm run typecheck",
  "deployCommand": "docker-compose up -d",
  "healthEndpoint": "http://localhost:3000/api/tasks",
  "healthTimeoutSeconds": 30,
  "autonomyLevel": "semi",
  "allowedAutoEnvs": ["local", "dev"],
  "maxAutoRiskLevel": "low",
  "requireCIGreen": true,
  "requireDevValidated": false,
  "autoMergeEnabled": false,
  "redLineRules": [
    "no-production",
    "no-secrets-in-diff",
    "no-destructive-commands",
    "no-db-migration-auto"
  ]
}
```
