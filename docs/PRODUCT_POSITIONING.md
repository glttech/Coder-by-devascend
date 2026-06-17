# Coder by DevAscend — Product Positioning

**Source document for website copy, pitch decks, and interview language.**  
Reflects what is actually built. No overclaiming.

---

## One-Liner

AI Tech Lead for small software teams — governance, risk scoring, and human approval gates for every AI-generated code change.

---

## Elevator Pitch (30 seconds)

Small teams are using Claude Code, Cursor, and ChatGPT to write software faster than ever. But none of those tools tell you whether the code is safe to merge, who approved it, or what risk it carries. Coder fills that gap. It runs seven specialised AI governance roles against every task — Product Analyst through Release Manager — scores the risk deterministically, and requires a human to approve anything above the threshold. Every step is logged. Nothing is auto-approved.

---

## Three-Sentence Description

Coder by DevAscend is a multi-agent AI delivery governance platform that sits between your team's AI coding tools and your production codebase. It coordinates seven AI agent roles — from Product Analyst to Release Manager — each producing structured findings and a risk score that feed a deterministic decision engine. Humans make every final approval call, and every step is written to an immutable audit log.

---

## Target Customer

**Primary:** Software teams of 2–10 engineers at startups or SMBs who are actively using one or more AI coding tools in daily development (Claude Code, Cursor, GitHub Copilot, Codex, ChatGPT) and have:

- No formal tech lead or architect reviewing AI-generated code before it merges
- No structured governance process for AI-assisted changes
- No audit trail for what the AI produced, who reviewed it, or why it was accepted
- Increasing pressure from technical debt accumulating from unreviewed AI output

**Secondary:** Solo engineers and technical founders building products with AI tools who want a structured governance layer without hiring a senior engineer yet.

**Not the target:** Enterprise teams with dedicated security and compliance infrastructure, or teams not using AI coding tools at all.

---

## Pain Point

> "We're shipping code faster with AI tools, but we have no idea if it's safe. We can't tell an auditor what changed, who reviewed it, or why we merged it."

The problem is not that AI writes bad code — it's that the output arrives without structure, without risk classification, and without any required review. A developer pastes a prompt, gets output, reviews it for 30 seconds, and ships it. There is no record of what was evaluated, no gate for high-risk changes, and no audit trail.

This is not a tooling problem. It is a governance gap.

---

## Key Differentiators

### vs. Using Claude Code or GitHub Copilot Alone

| Copilot / Claude Code alone | Coder by DevAscend |
|---|---|
| AI produces output; developer decides | AI produces findings; deterministic engine decides; human approves |
| No risk classification | 8 heuristic checks + 12 named risk patterns per change |
| No audit trail | Immutable append-only log of every prompt, response, decision, approval |
| No role separation | 7 specialised agent roles, each with a defined scope and output contract |
| No approval gate | `SENIOR_APPROVAL_REQUIRED` and `BLOCKED` decisions require human action |
| No structure to what the AI returns | Every agent role returns structured JSON: findings, risk score, affected files, recommendation |

### vs. Code Review in GitHub PRs Alone

GitHub PR review is peer review — it catches what the reviewer notices. Coder adds a structured pre-review layer: risk scoring, secret detection, scope drift analysis, and a documented recommendation before a human even opens the diff.

### vs. Building Your Own Governance Script

A homegrown heuristic script has no multi-agent role system, no approval workflow, no audit log, no SSE for real-time updates, no team collaboration, no API keys, and no webhook delivery. Coder has all of these, already built and tested.

---

## Feature-by-Feature Value

| Feature | Business Outcome |
|---|---|
| 7 AI agent roles with structured output | Every change gets a named, documented review from each governance perspective — not just a thumbs up/down |
| Deterministic risk analysis (8 checks, 12 patterns) | Risk classification is repeatable and not dependent on who reviewed it that day |
| `computeDecision` with 4 outcomes | High-risk changes are automatically escalated; blocked conditions stop the task immediately |
| Human approval gate (`approvalGuard`) | No AI recommendation can bypass human sign-off — the LLM recommends, humans decide |
| Immutable audit log | Every AI-assisted change has a documented evidence chain: what was prompted, what was found, who approved it |
| GitHub PR import + risk scoring | PRs get the same governance treatment as internal tasks — import by URL, score deterministically |
| Mermaid diagrams + SVG export | Architecture impact of a PR is visualised automatically from the file tree |
| CI/CD status dashboard | Red/yellow/green delivery health across all open PRs in one view |
| API keys with scoped permissions | Programmatic access to the governance platform for CI pipelines and tooling integrations |
| Webhook delivery with HMAC signing | Governance events can trigger downstream systems securely |
| Public share links for governance reports | Share an audit report with a stakeholder without giving them platform access |
| Real-time SSE events | Approval queues and agent runs update live without polling |
| Team invitations + RBAC | Role-appropriate access — viewers see findings, operators run agents, admins manage keys |
| Execution trace (append-only) | Per-decision record of prompt sent, model used, evidence used, risk score, decision, approval state |

---

## Competitive Positioning

**Not a linter.** Linters check syntax and style. Coder checks risk, context, intent, scope, and governance state.

**Not an AI assistant.** Coder does not write code. It governs code that AI tools already wrote.

**Not an observability tool.** Observability tells you what happened in production. Coder gates what gets to production in the first place.

**Not a CI/CD pipeline.** CI/CD runs automated tests. Coder provides the human-reviewed governance layer that CI/CD cannot provide — because CI/CD cannot tell you whether the change is appropriate, whether approval was given, or whether the risk was understood.

**The closest comparable category:** AI safety tooling and AI-assisted code review. No current mainstream tool combines multi-agent structured review, deterministic risk scoring, human approval gates, and an immutable audit trail in a single platform aimed at small teams.

---

## Demo Flow (5 Steps)

### Step 1 — Create a task

Open Coder, create a new task. Set the instruction ("Add authentication to the payments API"), risk level (high), environment (production), and mark it approval-required. The structured prompt is generated automatically: objective, scope, safety constraints, validation commands, and required output format.

### Step 2 — Run the agent roles

The orchestrator sequences the governance roles. The Security Reviewer scans for auth surface changes and secret exposure. The Architect checks the data model. The Reviewer compares the change against the declared scope. Each role returns a structured JSON object: findings, risk score, affected files, recommendation.

### Step 3 — See the decision

The deterministic engine receives all structured findings. Because the Security Reviewer flagged an auth surface change and the risk level is high, the engine returns `SENIOR_APPROVAL_REQUIRED`. The task status updates. The approval queue shows the pending item with the full evidence chain.

### Step 4 — Human approves

A team member opens the approval queue, reads the findings, reviews the risk score, and clicks Approve. The approval is persisted with their identity and the trace ID. The task can now progress.

### Step 5 — Audit trail

Every step is in the immutable audit log: task created, prompt sent to each role, structured findings returned, decision computed, approval granted. The log can be exported as CSV or shared via a public share link. This is the governance record for this AI-assisted change.

---

## Resume and Interview Positioning Language

Use this language to accurately describe what's built. Calibrate to the claim level you're comfortable defending.

**Conservative (entirely accurate to current state):**

> "Built a multi-agent AI delivery governance platform in Next.js 14, TypeScript, and PostgreSQL. The platform coordinates seven AI agent roles against software delivery tasks, evaluates structured findings through a deterministic risk analysis engine with 8 heuristic checks and 12 named risk patterns, and routes high-risk decisions to human approval gates. Includes immutable audit logging, GitHub PR import with risk scoring, CI status aggregation, API keys with SHA-256 hashing, HMAC-signed webhooks, SSE real-time events, and full auth with GitHub OAuth and role-based access control."

**With Phase 1 LLM wiring (accurate once PR 1.1 ships):**

> "Built a multi-agent AI orchestration and governance platform backed by Anthropic Claude. Seven specialised agent roles (Product Analyst through Release Manager) produce structured JSON findings via claude-opus-4-8, which feed an unchanged deterministic governance engine — risk scoring, decision computation, and approval gating — so the LLM recommends and humans decide. Includes RAG over project knowledge (pgvector, org-scoped), immutable execution trace, and a full audit log per AI-assisted task."

**Technical depth points for interviews:**

- The `computeDecision` function is pure and deterministic — LLM output is input, not the decision
- `approvalGuard` enforces the rule that LLM output can never set `Approval.approved = true`
- pgvector RAG uses cosine similarity with mandatory org-scoped filtering to prevent cross-tenant data bleed
- Prompt caching on stable governance system prompts (cache breakpoint before volatile diff content)
- Three-tier model selection: Opus for reasoning-heavy roles, Sonnet for balanced roles, Haiku for cheap sub-calls
- Feature flags (`FEATURE_AGENT_LLM=false` default) keep all existing deterministic tests green while adding LLM path

---

## Frequently Asked Questions

**Q: Is this ready for production use?**  
The governance platform itself — auth, task management, risk analysis, approval gates, audit logging, GitHub integration — is production-quality in its current implementation. The LLM agent orchestration (PR 1.1) is in active development and feature-flagged off by default. Teams can use the governance layer today for structured AI-assisted task management even before the LLM wiring is complete.

**Q: Does the AI make decisions automatically?**  
No. The LLM produces structured findings and a recommendation. A separate deterministic engine computes the decision. For decisions above the `SENIOR_APPROVAL_REQUIRED` threshold, a human must explicitly approve before the task can proceed. No LLM output can set `Approval.approved = true`.

**Q: What happens if the AI produces a bad recommendation?**  
The LLM output is evaluated by the `computeDecision` function, which runs independent heuristic checks. A bad recommendation that triggers a risk pattern (destructive commands, secret exposure, scope drift) will still produce a `BLOCKED` or `SENIOR_APPROVAL_REQUIRED` decision regardless of what the LLM recommended. The deterministic layer is not influenced by the LLM's recommendation text.

**Q: Is the audit log actually immutable?**  
The `AuditLog` and `ExecutionTrace` tables have no update or delete endpoints in the API, and no ORM operations in the codebase call `.update()` or `.delete()` on them. Immutability is enforced by convention at the application layer. Physical immutability (PostgreSQL row-level security, WAL archiving) is a Phase 2 hardening item.

**Q: How does this compare to just using GitHub PR reviews?**  
GitHub PR reviews are peer reviews — they catch what the reviewer notices and are not structured. Coder adds a pre-review layer: risk classification, structured findings from seven governance roles, secret scanning, scope drift detection, and a documented recommendation. The GitHub PR review can then focus on correctness rather than governance.

**Q: Does this replace the AI coding tools?**  
No. It governs their output. Developers continue to use Claude Code, Cursor, or Copilot to write code. Coder provides the governance layer between that output and production.

**Q: What's the data model like?**  
22 Prisma models: User, Organization, Membership, Project, Milestone, Task, PromptTemplate, AgentRun, Evaluation, Approval, AuditLog, Instruction, OperatorSession, Invitation, ShareLink, Comment, CiRun, GithubPR, Diagram, NotificationPreference, ApiKey, Webhook. All org-scoped. Append-only audit tables have no update/delete in the API.

**Q: What does the tech stack look like?**  
Next.js 14 App Router, TypeScript, Prisma ORM, PostgreSQL, iron-session, GitHub OAuth, SSE for real-time events, Resend for email, Mermaid for diagram generation. Anthropic Claude (`@anthropic-ai/sdk`) and pgvector are being added in Phase 1, behind feature flags.

**Q: Is this open source?**  
MIT license. See the repository for details.
