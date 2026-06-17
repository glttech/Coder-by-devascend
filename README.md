# Coder by DevAscend

**AI Tech Lead — Multi-Agent Delivery Governance for Small Software Teams**

> Before your team merges AI-generated code, Coder checks context, risk, security, test coverage, and release readiness.

---

## What It Is

Coder by DevAscend is a **multi-agent AI delivery governance platform** built for small engineering teams that are already using Claude Code, Cursor, Codex, or ChatGPT to write software — but have no structured governance layer, no review discipline, and no audit trail for the code those tools produce.

The platform coordinates seven specialised AI agent roles (Product Analyst, Architect, Developer, Reviewer, Security Reviewer, QA, Release Manager) across every task in a software delivery cycle. Each role produces a structured output — findings, a risk score, affected files, and a recommendation — which feeds a deterministic decision engine. The engine can emit four decisions: `CONTINUE`, `RUN_VALIDATION`, `SENIOR_APPROVAL_REQUIRED`, or `BLOCKED`. Humans, not the LLM, make every final call.

The governance layer is audit-first by design. Every task, every agent run, every evaluation, every approval decision, and every LLM recommendation is written to an immutable, append-only audit log. Nothing is overwritten. Nothing is auto-approved.

---

## Who It Is For

Small software teams of 2 to 10 engineers who:

- Are using AI coding tools (Claude Code, Cursor, Codex, ChatGPT) in day-to-day development
- Lack a formal tech lead or governance process for AI-generated changes
- Need an audit trail before AI-assisted code can be considered "done"
- Want structured risk assessment — not just a chat window — before anything reaches production

---

## The Problem It Solves

AI coding agents today produce output with no consistent structure, no safety gate, and no audit trail. A developer pastes a prompt, gets output, and either ships it or discards it — with no record of what was evaluated, who approved it, or why.

Coder imposes structure:

1. Every task is defined with a typed instruction, risk level, environment scope, and approval requirement.
2. Every agent role runs against that task, producing structured findings rather than raw text.
3. Every set of findings is evaluated by a deterministic risk analysis engine — 8 heuristic checks and 12 risk patterns — before a decision is produced.
4. Every decision above a threshold requires a human to approve before the task can progress.
5. Every step — prompt, response, decision, and approval — is written to an immutable audit log.

---

## Current Capabilities

### Authentication and Access Control

- Email/password registration and login (iron-session)
- GitHub OAuth login and account linking
- Role-based access control (viewer / operator / admin)
- API keys with scoped permissions, SHA-256 hashed, display-once
- Session management with CSRF protection and login rate limiting

### Project and Task Management

- Multi-project workspace with organisation scoping
- Task intake with typed instructions, risk levels (low / medium / high / critical), and environment scope (development / staging / production)
- Structured prompt generation: objective, scope, safety constraints, validation commands, required report format — generated automatically per task
- Approval-required flag: tasks that require explicit human sign-off before they can progress

### Multi-Agent Governance Roles

Seven built-in AI agent roles, each with a defined system prompt, output schema, allowed tools, and maximum risk level it can act on:

| Role | Responsibility |
|---|---|
| **Product Analyst** | Validates requirements, surfaces ambiguity, identifies scope risks |
| **Architect** | Reviews design decisions, data model changes, API contracts, and service boundaries |
| **Developer** | Reviews implementation quality, code structure, and adherence to task scope |
| **Reviewer** | Cross-checks code changes against stated objectives and acceptance criteria |
| **Security Reviewer** | Checks for secret exposure, auth surface changes, injection risk, and dependency vulnerabilities |
| **QA** | Assesses test coverage, edge case handling, and validation gaps |
| **Release Manager** | Evaluates deployment readiness, CI status, environment checks, and release checklists |

### Risk Analysis Engine

- 8 heuristic evaluation checks: required report sections, destructive commands, secret token exposure, unintended migrations, scope drift detection, and more
- 12 named risk patterns: auth/security changes, database migrations, production-environment scope, secrets exposure, and others
- Severity classifications per finding (low / medium / high / critical)
- Evidence gap detection: identifies what is missing before a decision can be made

### Decision Engine

Four deterministic outcomes from the `computeDecision` function:

| Decision | Meaning |
|---|---|
| `CONTINUE` | Risk acceptable; proceed |
| `RUN_VALIDATION` | Evidence gaps exist; run additional checks before proceeding |
| `SENIOR_APPROVAL_REQUIRED` | High-risk finding; requires explicit human approval |
| `BLOCKED` | Destructive or out-of-scope action detected; task is blocked |

### Human Approval Gates

The `approvalGuard` enforces the fundamental rule: **the LLM recommends, humans decide.** An LLM output can never set `Approval.approved = true`. Every approval decision is persisted in the database with the user who made it and the run that triggered it.

### Audit Log and Execution Trace

- Immutable, append-only `AuditLog` table — every event is written, nothing is updated or deleted
- Execution trace records: prompt sent, model used, evidence references, risk score, decision, and approval state per agent run
- CSV export of audit records
- Public share links for governance reports (scoped, revokable)

### GitHub Integration

- GitHub PR import by URL or owner/repo/PR number — upserted to the database with audit log entry
- Deterministic risk scoring on imported PRs via the same `riskAnalyzer` and `decisionEngine` pipeline
- Mermaid architecture diagrams generated from PR file trees (capped at 50 files), with SVG export and diagram persistence
- CI/CD status dashboard: aggregates CI run status across all open PRs with red/yellow/green project-level signals

### Team Collaboration

- Comments on tasks and projects
- Team invitations (7-day expiry, hashed tokens, accept/revoke flow)
- Notification preferences per user
- Organisation and membership management

### Platform and Operations

- Real-time events via Server-Sent Events (SSE) with channel-based subscriptions and keep-alive
- Webhook delivery with HMAC signing
- API keys with scoped permissions for programmatic access
- Dark/light theme, mobile responsive UI
- Rate limiting on login and API endpoints
- Billing usage tracking infrastructure (plan-gated features)

---

## What Makes It Different

**Governance-first, not just output capture.** Most teams using AI coding tools capture the output and call it done. Coder structures what happens before the output is accepted — risk classification, role-based review, decision gating — not after.

**LLM recommends, humans decide.** The AI agent produces structured findings and a recommendation. The deterministic engine produces a decision. A human approves or rejects. No step is skipped, no gate is auto-passed.

**Audit trail for every AI-assisted change.** Every prompt, every response, every evaluation finding, every decision, and every approval is written to an immutable log. The audit trail is first-class, not an afterthought.

**Deterministic governance engine.** The `computeDecision` and `riskAnalyzer` functions are pure, tested, and do not depend on LLM output to produce a decision. The LLM feeds it; the engine rules.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL via Prisma ORM |
| Auth | iron-session v8, GitHub OAuth |
| Styling | Custom CSS variables (no Tailwind) |
| Real-time | Server-Sent Events (SSE) |
| Email | Resend provider |
| Diagrams | Mermaid (server-side generation, SVG export) |
| CI | GitHub Actions |
| LLM (Phase 1+) | Anthropic Claude via `@anthropic-ai/sdk` (feature-flagged) |

---

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ — via Docker Compose or a local install

### 1. Clone and install

```bash
git clone https://github.com/glttech/Coder-by-devascend.git
cd Coder-by-devascend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and SESSION_SECRET at minimum
```

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aidv?schema=public"
SESSION_SECRET="your-32-char-minimum-secret-here"
```

For GitHub OAuth, add:

```
GITHUB_CLIENT_ID="your-github-app-client-id"
GITHUB_CLIENT_SECRET="your-github-app-client-secret"
GITHUB_CALLBACK_URL="http://localhost:3000/api/auth/github/callback"
```

> **Port note:** If port 5432 is in use, map Docker to 5433 (`5433:5432`) and update `DATABASE_URL` to `localhost:5433`.

### 3. Start the database

```bash
docker-compose up -d
```

### 4. Apply migrations and generate the Prisma client

```bash
npx prisma migrate dev --name init
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard loads immediately.

---

## Security Posture

| Control | Status |
|---|---|
| Session-based auth (iron-session) | Live |
| GitHub OAuth with token exchange | Live |
| CSRF protection | Live |
| Login rate limiting | Live |
| Role-based access control | Live |
| API keys: SHA-256 hashed, display-once | Live |
| Webhook delivery: HMAC-signed payloads | Live |
| No secrets written to database | Enforced — env vars only |
| No automatic shell or code execution | All agent runs are gated |
| Input validation on all API routes | 422 on bad fields |
| Approval gate before "done" | Human decision required |
| Audit log: append-only, no deletes | Enforced by design |
| Sandboxed LLM execution | Planned — Phase 1 with feature flag |

---

## Roadmap

The full technical roadmap is in [`IMPROVEMENT_PLAN_V2.md`](./IMPROVEMENT_PLAN_V2.md). Summary:

**Phase 1 — LLM-aware governance + RAG + trace (in progress)**
- Wire `@anthropic-ai/sdk` to the agent role system (behind `FEATURE_AGENT_LLM` flag)
- Add pgvector RAG knowledge base with mandatory secret redaction on ingest
- Immutable execution trace table with per-decision evidence references
- Approval workflow wiring for agent-driven decisions

**Phase 2 — Durable workflows + MCP connectors**
- TypeScript-native durable workflow engine (pause/resume/retry via row-status)
- Read-only MCP connectors: GitHub, Linear, Jira, Slack, Postgres, deploy logs
- All connector writes gated by approval flow

**Phase 3 — Saleable MVP**
- AI PR reviewer with deterministic risk score + agent findings
- Deployment readiness checklist (Release Manager role + CI status)
- Audit report PDF export per AI-assisted task
- Billing gates by plan (Free / Team / Pro)

**Phase 4 — Knowledge graph (optional)**
- Neo4j GraphRAG only if recursive SQL joins demonstrably fail at scale

---

## License

MIT — see `LICENSE`.
