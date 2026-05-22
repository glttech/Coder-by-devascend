# Coder by Devascend — Phase 1 Human-in-the-Loop AI Orchestration MVP

> **Portfolio project demonstrating governance-first AI development tooling.**
> Built to show how planning, coding, execution, validation, approval, and auditing
> can be separated across specialised AI tools while keeping a human in control at
> every critical decision point.

---

## What It Is

A **Phase 1 MVP** of an internal AI development orchestration and governance platform.
It acts as a coordination layer between a human operator and multiple AI coding tools
(Claude Code, OpenClaw, Open SWE, ChatGPT), structuring every task with a typed prompt,
capturing every agent response, evaluating it against safety heuristics, and requiring
explicit human approval before any action is considered done.

## Who It Is For

- Engineers building internal AI tooling who need more than a chat window
- Teams that want a structured, auditable record of every AI-generated change before it touches production
- Technical interviewers evaluating full-stack system design, AI governance thinking, and safe-deployment discipline

## What Problem It Solves

AI coding agents today produce output with no consistent structure, no safety gate, and no audit trail.
A developer pastes a prompt, gets output, and either ships it or discards it — with no record of what was evaluated, who approved it, or why.

This platform imposes structure:

1. Every task is defined with a typed instruction, risk level, environment scope, and approval requirement.
2. Every agent run is stored with the prompt that generated it, the tool that ran it, and the full response.
3. Every response is evaluated against a heuristic safety ruleset before the human is asked to approve.
4. Every approval decision is persisted in the database alongside the run that triggered it.

## What It Is Not

- **Not a production system.** Authentication, RBAC, sandboxed execution, and real observability integrations are Phase 2 work. This is a validated MVP.
- **Not an autonomous agent.** No AI tool is invoked automatically. All agent runs are manual copy/paste in Phase 1. Automation is a deliberate Phase 2 decision.
- **Not overclaiming integrations.** Langfuse, Promptfoo, and Open SWE adapters exist as typed stubs with documented extension points. They are not wired to live APIs yet.
- **Not an "AI CEO."** This is a governance and orchestration tool. Humans make every final call.

---

## Current Phase 1 Capabilities

| Capability | Status | Notes |
|---|---|---|
| Task intake (title, instruction, risk, environment, approval flag) | ✅ Live | 422 validation on all required fields |
| Structured prompt builder | ✅ Live | Sections: objective, scope, safety constraints, validation commands, required report format |
| Manual agent run capture | ✅ Live | Paste agent output → stored with prompt and tool selection |
| Heuristic response evaluation | ✅ Live | 8 checks: report sections ×5, destructive commands, secret exposure, migration detection, scope drift |
| Approval gate (approve / reject) | ✅ Live | Persisted in DB; task status reflects decision |
| Audit-oriented database | ✅ Live | Task, AgentRun, Evaluation, Approval, AuditLog tables via Prisma/PostgreSQL |
| Dashboard (counts, recent runs) | ✅ Live | Total tasks, pending approvals, failed evaluations, last 5 runs |
| GitHub Actions CI | ✅ Live | `npm ci` → `prisma generate/validate` → `next build` on every PR |
| End-to-end local workflow tested | ✅ Verified | Full cycle exercised via API and UI in local environment |
| Langfuse tracing | 🔶 Stub | Typed adapter logs to console; ready for real API in Phase 2 |
| Promptfoo runtime evaluation | 🔶 Stub | Package declared; heuristics inline pending Phase 2 wiring |
| Open SWE automation | 🔶 Stub | Adapter function defined; Phase 2 will call real API |
| Authentication / RBAC | ❌ Phase 2 | No auth layer in Phase 1 |

---

## Real Workflow Behind This Product

This project is itself built using the workflow it describes.
Each phase of development used a different specialised AI tool for its role:

```
┌──────────────────────────────────────────────────────────────────┐
│                     Human Operator (you)                         │
│          Plans, reviews, approves, and controls all gates        │
└───────────────────────┬──────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────────────┐
        ▼               ▼                       ▼
  ┌──────────┐   ┌─────────────┐        ┌──────────────┐
  │ ChatGPT  │   │ Claude Code │        │   OpenClaw   │
  │          │   │             │        │              │
  │ Planning │   │  Coding &   │        │ DevOps &     │
  │ Review   │   │  Repo impl  │        │ Server exec  │
  │ Governance│  │             │        │              │
  └──────────┘   └──────┬──────┘        └──────┬───────┘
                        │                      │
                        ▼                      ▼
                 ┌─────────────┐       ┌──────────────┐
                 │  GitHub CI  │       │  This App    │
                 │             │       │              │
                 │ Automated   │       │ Orchestrates,│
                 │ validation  │◄──────│ evaluates,   │
                 │ on every PR │       │ gates, audits│
                 └─────────────┘       └──────────────┘
```

| Tool | Role in the workflow |
|------|----------------------|
| **ChatGPT** | High-level planning, architectural review, governance decisions, prompt design |
| **Claude Code** | Coding, repository implementation, file-level changes, commit authoring |
| **OpenClaw** | DevOps tasks, server-side execution, infrastructure commands |
| **GitHub CI** | Automated validation gate: install, generate, build on every PR |
| **Human approval** | Final control gate — no task is "done" until explicitly approved in this UI |

---

## Demo Flow

```
1. Intake       →  Create task: title, instruction, risk level, environment, approval flag
                   POST /api/tasks  →  201 with task ID and auto-created project

2. Prompt       →  Open task detail page
                   Structured prompt generated: objective / scope / safety / validation / report format
                   "Copy Prompt" copies it to clipboard

3. Agent run    →  Paste prompt into Claude Code / OpenClaw / any agent
                   Copy full agent output
                   Paste into "New Agent Run" panel → POST /api/runs

4. Evaluation   →  8 heuristic checks run server-side:
                   ✓ All required report sections present
                   ✓ No destructive commands (rm -rf, DROP TABLE, force push)
                   ✓ No secret tokens in output (sk-, pk-, api_key)
                   ✓ No unintended migrations or dependency upgrades
                   ✓ No scope drift beyond declared files

5. Approval     →  If task flagged approvalRequired:
                   Approve → task status = "approved"
                   Reject  → task status = "rejected"

6. Audit trail  →  All steps stored: task, prompt, response, evaluations, approval decision, timestamps

7. CI           →  Every code change validated by GitHub Actions before merge
```

---

## Screenshots

> _Screenshots to be added after UI polish pass. Placeholders below._

### Dashboard — task counts, pending approvals, failed evaluations, recent runs
![Dashboard](docs/screenshots/dashboard.png)

### New Task — intake form with risk level, environment, and approval flag
![New Task](docs/screenshots/new-task.png)

### Task Detail — generated structured prompt with Copy button
![Task Prompt](docs/screenshots/task-prompt.png)

### Agent Run — paste response, view evaluation results inline
![Agent Run Evaluation](docs/screenshots/agent-run-evaluation.png)

### Approval Panel — approve or reject with persisted status
![Approval Panel](docs/screenshots/approval-panel.png)

### GitHub CI — passing check run on every PR
![GitHub CI](docs/screenshots/github-ci.png)

---

## Not Production Ready Yet

Phase 1 is a **validated MVP**. The following are known gaps, intentionally deferred to Phase 2:

| Gap | Risk if shipped now | Phase 2 plan |
|-----|--------------------|----|
| No authentication or RBAC | Any user can create, run, or approve any task | NextAuth.js + role-based gates |
| `Approval.approverId` always null | No record of who approved what | Wire to authenticated user session |
| Langfuse tracing is a console stub | No real observability of prompt/response quality over time | Replace stub with live Langfuse HTTP API |
| Promptfoo evaluation is inline heuristics only | Limited, brittle evaluation coverage | Wire to `promptfoo evaluate` at runtime |
| Open SWE invocation is manual copy/paste | Human bottleneck; no automation | Implement `submitToOpenSwe` with real API call |
| No sandboxed execution | Agent output trusted without safe execution layer | Implement per-run sandbox in Phase 2 |
| Audit log not surfaced in UI | AuditLog table exists but has no viewer | Build audit log page with export |
| No approval enforcement outside this app | Agents run externally; approval here does not block external tools | Requires webhook/API integration in Phase 2 |

---

## Phase 2 Roadmap

| Priority | Feature | Notes |
|----------|---------|-------|
| 🔴 P0 | Authentication + RBAC | Block all routes behind login; role: viewer / operator / approver |
| 🔴 P0 | Approval gate hardening | Tie `approverId` to authenticated user; block unapproved tasks from progressing |
| 🟠 P1 | Langfuse integration | Real trace logging for every prompt/response pair with evaluation metadata |
| 🟠 P1 | Promptfoo runtime evaluation | Replace inline heuristics with configurable test suites |
| 🟠 P1 | Audit log viewer | Surface AuditLog table with filters, timestamps, and CSV export |
| 🟡 P2 | GitHub-linked run evidence | Store PR URL, commit SHA, and CI run link alongside each AgentRun |
| 🟡 P2 | Open SWE automation | Invoke agent programmatically; capture diffs and commit hashes |
| 🟡 P2 | Project management UI | Create and list projects; scope tasks to repos |
| 🟢 P3 | Sandboxed execution | Containerised execution layer for agent-generated shell commands |
| 🟢 P3 | Notification hooks | Slack / email on pending approvals and failed evaluations |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL 15 via Prisma ORM |
| Styling | Plain CSS utility layer (no Tailwind dependency) |
| CI | GitHub Actions |
| Observability | Langfuse (stub — Phase 2) |
| Evaluation | Promptfoo (stub — Phase 2) |
| Agent adapter | Open SWE (stub — Phase 2) |
| Local DB | Docker Compose (postgres:15) or native Postgres |

---

## Project Structure

```
├── .github/workflows/ci.yml        # GitHub Actions: install → generate → validate → build
├── docker-compose.yml              # Local PostgreSQL service
├── prisma/
│   ├── schema.prisma               # Database models
│   └── migrations/                 # Versioned migration history
├── src/
│   ├── app/
│   │   ├── page.tsx                # Dashboard
│   │   ├── tasks/
│   │   │   ├── page.tsx            # Task list (force-dynamic)
│   │   │   ├── new/page.tsx        # Task intake form
│   │   │   └── [id]/page.tsx       # Task detail, prompt, runs, approval
│   │   └── api/
│   │       ├── tasks/route.ts      # GET list / POST create (with 422 validation)
│   │       ├── runs/route.ts       # POST record run + evaluate
│   │       └── approvals/route.ts  # POST approve/reject
│   ├── components/
│   │   ├── RunPromptPanel.tsx      # Paste agent response and submit
│   │   ├── EvaluationList.tsx      # Render evaluation check results
│   │   ├── ApprovalPanel.tsx       # Approve / reject UI
│   │   └── CopyButton.tsx          # Clipboard copy for generated prompt
│   └── lib/
│       ├── prisma.ts               # Singleton Prisma client
│       ├── promptBuilder.ts        # Structured prompt construction
│       ├── promptEvaluator.ts      # 8-check heuristic evaluator
│       ├── langfuse.ts             # Langfuse stub (Phase 2)
│       └── openSweAdapter.ts       # Open SWE stub (Phase 2)
├── .env.example                    # Environment variable template
└── package.json
```

---

## Setup

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 15+** — via Docker Compose (`docker-compose up -d`) or a local install

### 1. Clone and install

```bash
git clone https://github.com/glttech/Coder-by-devascend.git
cd Coder-by-devascend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL at minimum
```

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aidv?schema=public"
```

> **Port note:** If port 5432 is already in use, map Docker to 5433 (`5433:5432`) and set `DATABASE_URL` to `localhost:5433`.

### 3. Start the database

```bash
docker-compose up -d
# or start your local Postgres cluster
```

### 4. Apply migrations and generate the client

```bash
npx prisma migrate dev --name init
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard should load immediately.

---

## Usage Walkthrough

1. **Create a task** — click **Tasks → New Task**. Fill in the instruction, choose the agent tool, risk level, environment, and whether approval is required.
2. **Copy the prompt** — open the task detail page. The structured prompt is generated automatically. Click **Copy Prompt**.
3. **Run the agent manually** — paste the prompt into Claude Code, OpenClaw, ChatGPT, or any coding agent. Copy the full output.
4. **Record the run** — paste the agent output into the **New Agent Run** panel and submit. Evaluation results appear immediately below.
5. **Approve or reject** — if the task required approval, use the **Approval** panel. The task status updates and the decision is stored.
6. **Check the dashboard** — task counts, pending approvals, and failed evaluations update in real time.

---

## Integration Notes

### Langfuse
Adapters in `src/lib/langfuse.ts` log to console in Phase 1. To enable real tracing: add `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` to `.env`, then replace the stub functions with `fetch` calls against the [Langfuse HTTP API](https://langfuse.com/docs).

### Promptfoo
The `promptfoo` package is declared in `package.json`. The heuristic checks in `src/lib/promptEvaluator.ts` are a Phase 1 inline replacement. Phase 2 will call `promptfoo evaluate` at the `/api/runs` endpoint.

### Open SWE
`src/lib/openSweAdapter.ts` defines `submitToOpenSwe` as a typed stub. Phase 2 implementation should call the `create_deep_agent` entry point in the [Open SWE repository](https://github.com/langchain-ai/open-swe) and propagate the response back to the orchestrator.

---

## Security Posture (Phase 1)

| Control | Status |
|---------|--------|
| No secrets written to database | ✅ Enforced — env vars only |
| No automatic shell execution | ✅ All runs are manual copy/paste |
| Input validation on API routes | ✅ 422 on bad fields for task creation |
| Approval gate before "done" | ✅ UI enforced (within this app only in Phase 1) |
| Audit record for all events | ✅ AuditLog table populated |
| Authentication | ❌ Phase 2 |
| Sandboxed execution | ❌ Phase 2 |
| Langfuse redaction | ❌ Phase 2 (stub only) |

---

## License

MIT — see `LICENSE`.
