# Product Vision — AI Dev Orchestrator / Coder by DevAscend

> **Direction as of 2026-06-20:** Primary focus is the **Internal AI Work Control Room** (W-1…W-8) — tracking and managing Claude Code CLI work across Rahul's repos. The SOC module is paused (secondary). See `docs/ROADMAP.md` → W-Series for current build sequence.

## What This Product Is

Coder by DevAscend is a **personal AI engineering control room** — a self-hosted web application that lets one engineer (Rahul) govern AI-assisted development across multiple repositories with safety, auditability, and minimal daily intervention.

It sits between you and AI coding agents (Claude Code, OpenClaw, Codex, Open SWE) and enforces structured workflow, risk gating, evidence capture, and decision routing so that AI-generated changes are never blindly applied to code, infrastructure, or production systems.

---

## Who It Is For

**Primary user:** Rahul (sole operator in Phase 1–3)

The app is not a SaaS product. It is not multi-tenant. It is not designed for public onboarding. It is a personal productivity and safety tool for one engineer managing multiple AI-assisted projects with a high bar for correctness and auditability.

---

## What Problem It Solves

Running Claude Code or any AI coding agent on a real project is fast but dangerous without structure. The problems this product solves:

| Problem | Without This Product | With This Product |
|---------|---------------------|-------------------|
| Agent runs without context | Prompt improvised each time | Structured prompt generated from task config |
| No record of what the agent did | Mental note or ad-hoc doc | AgentRun + Evaluation stored per task |
| Unknown risk in agent output | Manually re-read everything | Risk flags computed automatically |
| Approval gates inconsistent | Sometimes asked, sometimes forgotten | Explicit approval model per task |
| No audit trail | Nothing to review later | Full AuditLog with every transition |
| Production changes sneaked in | No systematic check | Environment guard + red-line rules |
| Multiple projects lose state | Switching context manually | Project registry with task history |
| Instructions drift or get stale | No version tracking | SHA256 stateVersion on every instruction |

---

## Why This Is Different From Using Claude Code Directly

| Dimension | Claude Code directly | This product |
|-----------|---------------------|-------------|
| Prompt quality | Ad-hoc, varies | Structured, reproducible, safety-constrained |
| Risk detection | None | 7-flag heuristic analyzer with negation strip |
| Evidence capture | You copy-paste manually | Structured fields per run |
| Approval | You remember | Enforced gate with state machine |
| Audit | None | Immutable log for every transition |
| Multi-project | Tab switching | Unified dashboard with per-project context |
| Decision routing | You decide every time | Decision engine routes: CONTINUE / BLOCKED / SENIOR_APPROVAL |
| Instruction lifecycle | Git commit messages | Full lifecycle: draft → approved → executing → completed |
| Concurrent safety | Race conditions possible | Atomic approval writes with constraint guards |

---

## Phase 1 — Useful Manual Orchestrator (current state)

**Goal:** Replace the chaos of ad-hoc AI task management with structured, audited, human-approved workflows.

**Delivered:**
- Task intake form with risk/env/agent configuration
- Structured prompt generator with environment guards and safety constraints
- Agent run recording with 8-point heuristic evaluation
- Operator session workflow with risk analyzer, evidence checker, and decision engine
- Instruction lifecycle state machine (draft → completed / blocked)
- Approval gate with race-condition-safe atomic write
- API key guard (GOVERNANCE_API_KEY) on all `/api/*` routes
- Input length validation on all write endpoints
- SHA256 stateVersion for optimistic concurrency on instructions
- Full AuditLog on every state transition
- Dashboard with governance health indicators
- 124 unit tests, clean build, clean typecheck

**What Phase 1 is not:**
- Not connected to real GitHub repos
- Not running agents — all agent interaction is manual paste-in
- Not watching CI/CD
- Not deploying anything

---

## Phase 2 — GitHub-Aware Orchestrator

**Goal:** Connect the orchestrator to real GitHub repos so it can read PRs, commits, CI status, and diff evidence automatically instead of requiring manual paste-in.

**Adds:**
- Project registry with GitHub repo URL, branch, PAT/token scope
- GitHub PR reader: auto-populate AgentRun with files changed, commit SHA, CI status
- GitHub webhook receiver: react to PR events (opened, CI passed/failed, merged)
- PR evidence auto-import: replace manual response paste-in with GitHub API pull
- Commit-level diff viewer in task detail
- Dashboard shows live CI status per task

**Outcome:** The operator session fills in most fields automatically; Rahul only reviews the decision and approves or blocks.

---

## Phase 3 — DEV Deployment-Aware Orchestrator

**Goal:** Know whether the DEV server is healthy after each agent run, without deploying to production.

**Adds:**
- Project registry: DEV server URL, health endpoint, container names, deploy command
- Post-run validation: hit DEV health endpoint after each approved agent run
- Container status probe: check if dev container is running before/after task
- Deployment log capture: pull `docker logs` or similar into evidence
- Dashboard: DEV server health column per project

**Outcome:** The decision engine can factor in "DEV deploy succeeded" or "DEV server down after this change" as evidence before recommending CONTINUE.

---

## Phase 4 — Semi-Autonomous Sub-Agent Workflow

**Goal:** Delegate repeatable low-risk tasks (docs, tests, minor refactors) to sub-agents that run under policy, with Rahul only reviewing exceptions.

**Adds:**
- Sub-agent role definitions: CTO, CISO, QA, DevOps, Product, Docs
- Policy engine: per-role autonomy levels, red-line rules, allowed environments
- Task routing: automatically assign incoming task to the appropriate sub-agent policy
- Auto-merge gate: low-risk DEV-only tasks meeting all criteria can be approved without manual Rahul click
- Exception queue: only BLOCKED and SENIOR_APPROVAL tasks surface to Rahul
- Langfuse integration: full trace/observation logging for all agent calls

**Outcome:** Rahul reviews 2–3 exceptions per day instead of every single task.

---

## Phase 5 — Production-Grade Governance

**Goal:** The product can safely govern changes that touch staging and production, with full evidence chain.

**Adds:**
- Real session/auth (Rahul login, not just API key)
- Rate limiting on all mutation endpoints
- Multi-project isolation: per-project API key scopes
- CISO policy: no production deploy without: green CI, passing tests, DEV validation, senior approval
- Database migration gate: migrations require separate approval workflow
- Secret rotation detection: flag if `.env` or credentials appear in any diff
- Evidence completeness score per task before any production gate passes

**Outcome:** The orchestrator can be trusted to govern staging and production changes, not just DEV.
