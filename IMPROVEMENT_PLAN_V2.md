# Coder by DevAscend — V2 Roadmap
## Multi-Agent AI Delivery Governance Platform

> **Position:** "An AI Tech Lead platform that plans, reviews, governs, and audits
> AI-assisted software delivery for small engineering teams."

**Tech stack (fixed core):** Next.js 14 App Router · TypeScript · Prisma 5 · PostgreSQL ·
iron-session v8 · React 18 · custom CSS variables.  
**New additions:** `@anthropic-ai/sdk` · pgvector · embeddings provider (not Anthropic — see decision 4) · Anthropic Claude models.

---

## Executive Summary

**Feasibility: High.**

The existing codebase already implements ~80% of the governance scaffolding this vision
requires — append-only `AuditLog`, `Approval` gates, `computeDecision`
(CONTINUE / RUN_VALIDATION / SENIOR_APPROVAL_REQUIRED / BLOCKED), risk analysis,
evidence checking, prompt construction, org/RBAC/API-key/webhook/SSE infrastructure,
and 672 passing tests.

**The single largest gap:** no LLM is wired. `langfuse.ts` and `openSweAdapter.ts` are
stubs. `prSummary.ts` is deterministic-by-design. Zero embedding/vector code exists.

**The work is genuinely additive.** Wrap the existing deterministic engine with a real
LLM call path that still routes through the same gates. Add a RAG layer. Nothing
existing is broken or replaced.

**Golden rule:** the LLM is a *recommendation producer*. Its output feeds the
**unchanged** `computeDecision`/`approvalGuard` pipeline. The LLM never sets
`Approval.approved = true`.

---

## Hard Constraints (carry forward from V1 — never relaxed)

- No real external agent execution without approval gates
- All execution-related feature flags default to `false`
- Do not weaken: auth, RBAC, CSRF, session revocation, audit logging, approval gates
- API key hashing (SHA-256, display-once) preserved
- No secrets in logs, tests, fixtures, or traces
- No auto-applied DB migrations — every schema change is a reviewed hand-written SQL file
- Never replace working deterministic code (`prSummary`, `riskAnalyzer`, `decisionEngine`) — wrap and feed it

---

## Technology Decisions

### 1. pgvector vs. dedicated vector DB → **USE pgvector. Skip Pinecone/Weaviate/Qdrant.**

Prisma does not natively support the `vector` column type. Use the documented workaround:
declare `embedding Unsupported("vector(1536)")` in `schema.prisma` and create the
extension + HNSW index in a **hand-written SQL migration**.

Run queries via `prisma.$queryRaw` with the `<=>` cosine operator, **always filtered by
`orgId`**.

**Why pgvector wins here:** the relational-join capability is the whole point of
governance RAG — "which files are affected" requires joining vectors against
`GithubPR`, `Task`, and `Project` rows in a single query. A separate vector DB loses
that. Small-team corpora (PRDs, READMEs, PRs, incidents) are megabytes, not billions
of vectors.

### 2. LangGraph / Python → **SKIP. Build a small TS state machine in Phase 2.**

The codebase already has durable-workflow primitives:
- `Instruction` has an explicit lifecycle (`draft → pending_approval → approved → executing → completed → blocked`)
- `stateVersion.ts` provides SHA-256 optimistic concurrency
- `OperatorSession` carries `currentStep` + per-step decision state

Phase 2 "durable workflows" = new `Workflow` + `WorkflowStep` tables with guarded
status transitions. Pause/resume/retry = row-status changes. Fully testable with
`tsx --test`. No graph framework, no Python runtime, no second deploy target.

### 3. MCP connectors → **DEFER to Phase 2. Embed as outbound MCP *clients*, server-side only.**

Connectors are **read-mostly evidence sources**, not action surfaces.
- Phase 1: direct API clients (`githubClient.ts` pattern) wrapped behind a common `connectors/` interface
- Phase 2: optionally adopt the official MCP TypeScript SDK for standardised protocol
- Any *write* action (create PR, post to Slack, trigger deploy) must flow through an `Approval`/`Instruction` gate — never executed directly from an LLM tool call
- Gate behind `FEATURE_MCP_CONNECTORS=false`

### 4. LLM provider → **`@anthropic-ai/sdk` directly. Thin internal seam, not a framework.**

Models:
| Role | Model | Why |
|---|---|---|
| Architect, Security Reviewer, Reviewer | `claude-opus-4-8` | Reasoning quality matters |
| QA, Release Manager | `claude-sonnet-4-6` | Good balance |
| Classification sub-calls | `claude-haiku-4-5` | Cheapest for "does this PR touch auth?" |

Structured output: `output_config: { format: { type: "json_schema", schema } }` per role so
each agent returns a typed object (findings, riskScore, affectedFiles, recommendation,
evidenceGaps) that feeds the deterministic engine.

Prompt caching: the governance system prompt (role definition, stop-conditions, output
contract) is large and stable → put it first with `cache_control: { type: "ephemeral" }`.
Volatile content (diff, retrieved chunks) goes after the cache breakpoint.

**Critical fact: Anthropic has no embeddings endpoint.** RAG embeddings require a
separate provider (OpenAI `text-embedding-3-small`, Voyage AI, or self-hosted). This
is the one place a second provider is unavoidable — `llm/embeddings.ts` is genuinely
provider-agnostic; `llm/chat.ts` stays Anthropic-specific.

### 5. Neo4j GraphRAG → **SKIP. Revisit only at Phase 4 if SQL joins demonstrably fall short.**

The relationships this vision wants (task↔files↔services↔risks↔owners↔incidents) are
mostly already foreign keys in the relational model. Multi-hop questions over small-team
data resolve fine with recursive CTEs. Add Neo4j only if a concrete query proves
intractable in SQL — that's a Phase 4 decision, not a Phase 1 bet.

### 6. RAG document pipeline → **Build natively in TypeScript. No LangChain.**

Pipeline: extract → redact → chunk → embed → store(pgvector) → retrieve

Redaction is mandatory and non-negotiable: a pre-chunk pass strips secrets using
`riskAnalyzer.ts` patterns as the seed set. Every vector query is org-scoped.

---

## Phase 1 — Agent Orchestration + RAG + Trace + Approval Wiring

> Theme: make the existing deterministic governance loop LLM-aware (behind flags) and
> add RAG, richer execution traces, and the multi-agent role system — all reusing
> `computeDecision`, `approvalGuard`, `writeAudit`, `getCurrentUser`/`requireRole`,
> the SSE bus, and existing route conventions.

### PR 1.1 — Multi-Agent Role System
**Priority:** P0 · **Effort:** XL · **Depends on:** current main

#### Schema additions (hand-written migration)
```sql
-- New table
CREATE TABLE "AgentRole" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'org_default',
  key TEXT NOT NULL,                    -- e.g. "security_reviewer"
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  max_risk_level TEXT NOT NULL DEFAULT 'medium',
  output_format TEXT NOT NULL,          -- JSON schema name
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, key)
);

-- Additive columns on AgentRun
ALTER TABLE "AgentRun" ADD COLUMN role_key TEXT;
ALTER TABLE "AgentRun" ADD COLUMN model_used TEXT;
ALTER TABLE "AgentRun" ADD COLUMN structured_output TEXT;
ALTER TABLE "AgentRun" ADD COLUMN risk_score FLOAT;
ALTER TABLE "AgentRun" ADD COLUMN prompt_tokens INT;
ALTER TABLE "AgentRun" ADD COLUMN completion_tokens INT;
ALTER TABLE "AgentRun" ADD COLUMN cached_tokens INT;
```

#### Prisma schema additions
```prisma
model AgentRole {
  id           String   @id @default(uuid())
  orgId        String   @default("org_default")
  key          String
  name         String
  systemPrompt String   @db.Text
  allowedTools String[]
  maxRiskLevel String   @default("medium")
  outputFormat String
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([orgId, key])
}
```

Plus additive columns on existing `AgentRun` model.

#### New lib modules

**`src/lib/agents/roles.ts`**
- 7 built-in role definitions: Product Analyst, Architect, Developer, Reviewer,
  Security Reviewer, QA, Release Manager
- `getRole(key)`, `listRoles()`, `assertRoleCanActOn(role, riskLevel)` — throws
  if the role's `maxRiskLevel` is lower than the task's risk level

**`src/lib/llm/chat.ts`**
- Anthropic singleton (like `prisma.ts`)
- `runAgent({ role, taskContext, retrievedChunks, evidence }): Promise<StructuredAgentResult>`
- Builds cached system prompt from role definition + `promptBuilder.ts` stop-conditions
- Calls `claude-opus-4-8` with structured output schema
- Streams deltas to SSE bus (`src/lib/events/bus.ts`)
- Returns parsed, typed result
- **When `FEATURE_AGENT_LLM=false` (default):** returns a deterministic stub so all
  existing 672 tests stay green

**`src/lib/llm/schemas.ts`**
- JSON schemas per role output: `{ findings: Finding[], affectedFiles: string[], riskScore: number, recommendation: string, evidenceGaps: string[] }`

**`src/lib/agents/orchestrator.ts`**
- Sequences roles for a task
- Passes each role's structured output into **unchanged** `computeDecision` /
  `analyzeRisk` / `checkMissingEvidence`
- LLM proposes → deterministic engine decides → human approves
- `assertRoleCanActOn` blocks a role from acting above its `maxRiskLevel`
- Writes `AgentRun` rows and calls `writeAudit` at each step

#### API routes
| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/api/agent-roles` | any | List enabled roles for org |
| POST | `/api/agent-roles` | admin | Create/update custom role |
| POST | `/api/tasks/[id]/agent-run` | any | Kick off orchestrated role run → 202 + SSE stream |
| GET | `/api/agent-runs/[id]` | any | Fetch run + structured output + decision |

#### UI
`src/app/tasks/[id]/agents/page.tsx` — Agent Orchestration Console:
- Role pipeline view showing each role's status
- Live SSE progress (reuse existing `useEventStream` hook)
- Structured findings from each role
- Decision badge (reuse existing decision display components)
- Approve / block wired to existing `/api/approvals` route

#### Security
- LLM output can never set `Approval.approved = true`
- `assertRoleCanActOn` enforces `maxRiskLevel`
- `FEATURE_AGENT_LLM` defaults `false`
- Anthropic API key in env only, never logged (redact `ANTHROPIC_API_KEY` in `logger.ts`)

#### Tests
- `roles.test.ts` — role lookup, maxRiskLevel enforcement
- `orchestrator.test.ts` — stub LLM output → correct `computeDecision` outcome;
  high-risk finding still routes to SENIOR_APPROVAL_REQUIRED
- `chat.test.ts` — flag-off returns stub; structured output schema validation

---

### PR 1.2 — RAG Knowledge Base
**Priority:** P0 · **Effort:** L · **Depends on:** PR 1.1

#### Schema additions (hand-written migration)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "KnowledgeDocument" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  project_id  TEXT,
  title       TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- "upload" | "github_pr" | "readme" | "incident"
  source_ref  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- "pending"|"ready"|"error"
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "DocumentChunk" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  project_id  TEXT,
  document_id TEXT NOT NULL REFERENCES "KnowledgeDocument"(id) ON DELETE CASCADE,
  ordinal     INT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  token_count INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
  WHERE org_id IS NOT NULL;
CREATE INDEX ON "DocumentChunk"(org_id, project_id);
```

Prisma schema: declare `embedding Unsupported("vector(1536)")` on `DocumentChunk`.

#### New lib modules

**`src/lib/rag/redact.ts`** — mandatory pre-chunk pass
- Seeds patterns from `src/lib/riskAnalyzer.ts` regex set
- Additional patterns: `.env` lines, `Bearer `+token, `Authorization:` headers
- Pure function, heavily tested with **fake** secret fixtures (never real credentials)

**`src/lib/rag/chunk.ts`** — recursive semantic-boundary chunking
- ~500–1000 tokens per chunk, ~100 token overlap
- Pure function, unit-testable with no DB dependency

**`src/lib/llm/embeddings.ts`** — provider-agnostic (not Anthropic)
- Interface: `embed(texts: string[]): Promise<number[][]>`
- Default implementation: OpenAI `text-embedding-3-small` (1536 dims)
- Batched; respects rate limits

**`src/lib/rag/ingest.ts`**
- Orchestrates: extract → redact → chunk → embed → store
- Calls `writeAudit({ event: 'document_ingested' })`
- Returns `{ documentId, chunks, redactedCount }`

**`src/lib/rag/retrieve.ts`**
- `retrieve({ orgId, projectId?, query, k = 8 }): Promise<RetrievedChunk[]>`
- `prisma.$queryRaw` cosine search, **always filtered by `orgId`** first
- Returns content + source metadata for prompt injection

#### API routes
| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/api/knowledge/documents` | any | Upload + ingest doc (redaction mandatory) |
| GET | `/api/knowledge/documents` | any | List documents for org |
| DELETE | `/api/knowledge/documents/[id]` | admin | Delete doc + chunks |
| GET | `/api/knowledge/search?q=&projectId=` | any | Semantic search (org-scoped) |

#### UI
`src/app/knowledge/page.tsx` — upload docs, list corpus, semantic search panel.
Project pages get a "Context" panel: ask "What changed?", "What risk exists?",
"Which files are affected?", "Is this ready to merge?" — calls retrieve + a QA role.

#### Security
- Redaction mandatory before storage (tested: no secrets can survive ingestion)
- Every vector query filtered by `orgId` (tested: cross-org query returns empty)
- Embedding provider API key in env only, never logged
- No raw document bytes in `AuditLog` or logs

#### Tests
- `redact.test.ts` — fake secrets stripped correctly; known-safe content passes through
- `chunk.test.ts` — chunk boundaries, token counts
- `retrieve.test.ts` — org-scoping: org A cannot retrieve org B's chunks

---

### PR 1.3 — Execution Trace (immutable append-only)
**Priority:** P1 · **Effort:** M · **Depends on:** PR 1.1

#### Schema (hand-written migration)
```sql
CREATE TABLE "ExecutionTrace" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,
  task_id         TEXT,
  agent_run_id    TEXT,
  role_key        TEXT,
  prompt_sent     TEXT,          -- redacted on write
  model_used      TEXT,
  tool_calls      TEXT,          -- JSON, redacted
  evidence_refs   TEXT,          -- JSON array of chunk IDs
  risk_score      FLOAT,
  decision_code   TEXT,
  approval_state  TEXT,
  final_output    TEXT,          -- redacted on write
  prompt_tokens   INT,
  completion_tokens INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — append-only by design
);
CREATE INDEX ON "ExecutionTrace"(org_id, task_id);
```

#### New lib module

**`src/lib/trace/writer.ts`** — modeled on `writeAudit`
- `writeTrace(entry)` — never throws (fire-and-forget pattern like `writeAudit`)
- Mandatory redaction pass on `promptSent` and `finalOutput` before persist
- Always paired with a `writeAudit` entry for the lightweight event index
- No update/delete functions exist (append-only by convention)

#### API routes
- `GET /api/traces?taskId=` — read-only, org-scoped
- `GET /api/traces/[id]` — single trace detail
- `GET /api/traces/export?taskId=` — CSV via existing `buildCsv` helper

**No write/update/delete endpoints.**

#### UI
`src/app/tasks/[id]/trace/page.tsx` — full per-decision trace:
prompt sent, model, tools, evidence chunks used, risk score, decision, approval state,
final output.

#### Tests
- `traceWriter.test.ts` — redaction on persist; never throws; no mutation API exists

---

### PR 1.4 — Approval Workflow Wiring for Agent Runs
**Priority:** P0 · **Effort:** S–M · **Depends on:** PR 1.1 + PR 1.3

Reuse **unchanged**: `Approval`, `Instruction` lifecycle, `approvalGuard.checkApprovalAllowed`,
`computeDecision`'s `SENIOR_APPROVAL_REQUIRED`/`BLOCKED`.

**New wiring:**
- When `orchestrator` produces `SENIOR_APPROVAL_REQUIRED` or `BLOCKED`, it creates/links
  an `Approval` and sets task status to `pending_approval` — never auto-approves
- Add `riskScore` and `recommendedAction` from the agent to the approval payload
  so reviewers see *why* the gate fired
- Link trace ID to approval so reviewer can drill into the full evidence chain

**UI:** extend `src/app/approvals/page.tsx` (or add `src/app/approvals/queue/page.tsx`)
with a consolidated "Pending AI Approvals" view — shows role, risk score, recommendation,
and trace link for each pending item.

**Tests:** extend `approvalGuard.test.ts` — agent-driven high-risk finding must trigger
the gate; LLM cannot satisfy the gate condition.

---

## Phase 2 — MCP Connectors + Durable Workflows

> Theme: connect to the outside world (evidence sources only), make long-running
> workflows pausable and resumable.

### Durable Workflow Engine

**Schema:** `Workflow` + `WorkflowStep` tables. Each step row carries:
`status` (pending / running / paused / awaiting_approval / completed / failed / blocked),
`stateVersion` (reuse `stateVersion.ts`), `input TEXT`, `output TEXT`, `attempts INT`,
`errorMessage TEXT`.

**`src/lib/workflow/engine.ts`**
- Advances steps via guarded transitions (reuse `approvalGuard` pattern)
- Pause/resume/retry = status row changes
- State preserved = persisted rows (replay-safe)
- Steps that perform external *writes* must emit an `Approval` gate before executing

**Built-in pipelines:**
1. Feature planning (Product Analyst → Architect → Developer role sequence)
2. PR review (Reviewer + Security Reviewer → risk score → approval)
3. QA check (QA role → test coverage analysis → approval)
4. Release readiness (Release Manager role → CI status + checklist → approval)

**Feature flag:** `FEATURE_DURABLE_WORKFLOWS=false` default.

### MCP Connectors

**`src/lib/connectors/`** — common `Connector` interface:
```typescript
interface Connector {
  id: string;
  name: string;
  read(params: ConnectorReadParams): Promise<ConnectorResult>;
  // write() intentionally omitted — all writes go through Approval gates
}
```

**Phase 2 connectors (read evidence sources):**
- `GithubConnector` — wraps existing `githubClient.ts`
- `LinearConnector` / `JiraConnector`
- `SlackConnector` (read channel history for context)
- `PostgresConnector` (read schema + query logs)
- `DeployLogConnector`

**Credentials:** stored like API keys (env-configurable; never logged).
**Gate:** `FEATURE_MCP_CONNECTORS=false` default.

---

## Phase 3 — Saleable MVP

> Promise: "Before your team merges AI-generated code, Coder checks context, risk,
> security, test coverage, and release readiness."

### Feature set

| Feature | Powered by |
|---|---|
| **AI PR reviewer with risk score** | Security Reviewer + Reviewer roles over `GithubPR` + RAG context → `computeDecision` |
| **Project knowledge RAG** | Phase 1.2 knowledge base with project-scoped retrieval |
| **Security & secrets checklist** | `riskAnalyzer.ts` patterns + Security Reviewer role |
| **Deployment readiness checklist** | Release Manager role + `CiRun` status + environment checks |
| **Release notes generator** | Release Manager role over merged `GithubPR` records |
| **Team approval workflow** | Phase 1.4 wiring + existing `Approval` model |
| **Audit report per AI-assisted task** | Phase 1.3 trace → PDF via existing `pdfStyles.ts` infrastructure |

### Monetization

`Organization.plan` field already exists. `usage.ts` + `/api/billing/usage` + `FEATURE_BILLING` scaffolding in place. Gate by plan:

| Tier | Limits |
|---|---|
| Free | 20 AI agent runs/month, 5 documents in RAG, 1 project |
| Team ($X/month) | Unlimited runs, 50 documents, 5 projects, audit report export |
| Pro ($Y/month) | Unlimited, all connectors, custom agent roles, priority support |

The per-task audit report PDF is the differentiated compliance-friendly sell.

---

## Phase 4 — Neo4j Knowledge Graph (optional, later)

**When to add:** only if a concrete retrieval question requires deep multi-hop traversal
(>3 hops) that pgvector + SQL joins handle poorly.

**What it would replace:** deep relationship queries that today require recursive CTEs
and perform poorly at scale. It would *augment* pgvector, not replace it — pgvector
stays the semantic layer; Neo4j adds the graph traversal layer.

**What to map:** task ↔ files ↔ services ↔ APIs ↔ risks ↔ owners ↔ incidents ↔ releases.

**GraphRAG:** use Neo4j's GraphRAG package for entity extraction, embeddings, graph
search, vector search, and GraphRAG retrieval.

**Do not add Neo4j in Phase 1–3.** The relationship model already in foreign keys covers
Phase 1–3 queries comfortably.

---

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| 1 | LLM output erodes an approval gate | LLM output is *input* to `computeDecision`/`approvalGuard`, never a decision; `assertRoleCanActOn` enforces `maxRiskLevel`; flags default off; tests assert high-risk findings still escalate |
| 2 | Secret/PII leakage into RAG, traces, or prompts | Mandatory redaction on ingest AND trace-persist (seeded from `riskAnalyzer` regexes); fixtures use fake secrets only; no document bytes or prompts in logs |
| 3 | Cross-org data bleed in RAG | Every vector query and document/trace read filtered by `orgId` first; tests prove org-scoping cannot be bypassed |
| 4 | Cost/latency from LLM + embeddings | Prompt caching on stable governance system prompt; `claude-haiku-4-5` for cheap sub-calls; pgvector (no extra infra); token accounting persisted on `AgentRun` and surfaced via `/api/billing/usage` |
| 5 | Scope drift into autonomous execution | No code-executing or external-write tool in Phase 1–3; all writes gated; `FEATURE_AGENT_EXECUTION` and `FEATURE_MCP_CONNECTORS` default false |

---

## What NOT to Build

- **No autonomous agent execution** of code or shell in Phase 1–3
- **No dedicated vector DB** (pgvector is sufficient; Pinecone/Weaviate/Qdrant add infra cost and lose relational joins)
- **No Python/LangGraph** — TS state machine on existing data model is sufficient
- **No write-capable MCP/connector actions** without an `Approval` gate
- **No weakening** of auth, RBAC, CSRF, session revocation, audit logging, approval gates, or API-key hashing
- **No auto-applied DB migrations** — every schema change ships as a reviewed SQL file
- **No provider-agnostic chat abstraction framework** — one thin Anthropic seam for chat; genuine provider-agnostic seam only for embeddings (because Anthropic has no embeddings endpoint)
- **No replacing working deterministic code** (`prSummary`, `riskAnalyzer`, `decisionEngine`) — wrap and feed it, don't remove it
- **No Neo4j in Phase 1–3** — foreign keys + recursive CTEs cover the query surface

---

## New Environment Variables (Phase 1)

| Variable | Default | Purpose |
|---|---|---|
| `FEATURE_AGENT_LLM` | `false` | Enable live LLM calls (off = deterministic stubs) |
| `ANTHROPIC_API_KEY` | — | Required when `FEATURE_AGENT_LLM=true` |
| `EMBEDDINGS_PROVIDER` | `openai` | `openai` or custom |
| `OPENAI_API_KEY` | — | Required for embeddings (Anthropic has no embeddings endpoint) |
| `EMBEDDINGS_MODEL` | `text-embedding-3-small` | Embedding model; 1536 dims |
| `EMBEDDINGS_DIMENSIONS` | `1536` | Must match pgvector column width |

---

## Phasing Summary

| Phase | Theme | Key deliverables | Effort |
|---|---|---|---|
| **1** | LLM-aware governance + RAG + trace | Agent roles, orchestrator, knowledge base, execution trace, approval wiring | ~8–12 weeks solo |
| **2** | Durable workflows + MCP connectors | Workflow engine, 5 connectors, full delivery pipeline | ~6–8 weeks |
| **3** | Saleable MVP | AI PR reviewer, release notes, deployment checklist, audit report PDF, billing gates | ~4–6 weeks |
| **4** | Knowledge graph | Neo4j GraphRAG, only when SQL proves insufficient | TBD |

---

## Resume / Positioning Outcome (after Phase 3)

> "Built an enterprise-grade multi-agent AI orchestration platform for AI-assisted
> software delivery — with RAG over project knowledge (pgvector), structured agent
> roles orchestrated via Claude (Anthropic), deterministic governance gates (approval
> workflows, risk analysis, decision engine), MCP-based evidence connectors, durable
> workflow state, audit logs, and release governance for small engineering teams."

This directly evidences AI Tech Lead skills: multi-agent orchestration, RAG, MCP
integrations, LLM structured output, prompt engineering, observability, governance,
and production reliability — built on a real, tested, deployed-quality codebase.
