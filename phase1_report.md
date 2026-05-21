# AI Dev Orchestrator – Phase 1 MVP Report

## Overview

The **AI Dev Orchestrator** project provides an internal control layer that ties together open‑source coding agents (Open SWE), evaluation tooling (Promptfoo) and trace logging (Langfuse) while strictly adhering to human‑in‑the‑loop workflows.  The Phase 1 minimum viable product focuses on capturing tasks, generating structured prompts, storing agent responses, performing safety checks and routing high‑risk actions through approval gates.  Full automation and direct integration with external agent frameworks are intentionally deferred to later phases.

## Repository Layout

The project is organised as a Next.js application with a PostgreSQL backend managed by Prisma.  A local development database runs via Docker Compose.  The code lives under the `src/` directory, following the Next.js app router conventions.

Key components include:

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Defines database models: `User`, `Project`, `Task`, `PromptTemplate`, `AgentRun`, `Evaluation`, `Approval` and `AuditLog`. |
| `src/lib/prisma.ts` | Singleton Prisma client for database access. |
| `src/lib/promptBuilder.ts` | Constructs structured execution prompts from raw task instructions. |
| `src/lib/promptEvaluator.ts` | Implements simple heuristic checks for missing report sections, destructive commands, secret exposure, migrations/upgrades and scope drift. |
| `src/lib/langfuse.ts` | Stubbed helper functions for creating and logging traces to Langfuse; ready to be replaced with real API calls. |
| `src/lib/openSweAdapter.ts` | Placeholder adapter that documents how to integrate with Open SWE; currently instructs users to perform manual runs. |
| `src/app/api/*` | API routes for creating tasks, submitting agent runs, recording approvals and returning lists. |
| `src/app/tasks/*` | App pages for listing tasks, creating new tasks and viewing task details. |
| `src/components/*` | Client‑side components for submitting agent responses, displaying evaluations and managing approvals. |
| `docker-compose.yml` | Launches a PostgreSQL 15 instance for local development. |
| `.env.example` | Provides environment variables for the database and integration keys (Langfuse, Promptfoo). |
| `README.md` | Setup instructions, usage guide and roadmap for future work. |

## Implemented Functionality

### Task Intake

The `/tasks/new` page presents a form where users supply a title, raw instruction, target agent/tool, risk level, environment and whether approval is required.  On submission the form posts to the `/api/tasks` endpoint, which creates a new record in the `Task` table.

### Prompt Generation

On the task detail page (`/tasks/[id]`) the raw instruction is transformed into a structured execution prompt using the default format specified by the user.  The prompt sections include **Objective**, **Scope**, **Files/areas to inspect**, **Files/areas not to touch**, **Safety constraints**, **Exact expected changes**, **Validation commands/checks** and a **Required final report format** with explicit bullet points.  A **Copy Prompt** button uses the browser clipboard API to copy the prompt for manual use.

### Manual Agent Runs

Because Phase 1 forbids automatic execution, a **New Agent Run** panel on the task page allows users to paste the output they receive from running the prompt in a tool such as Claude Code, Codex or OpenClaw.  When the response is submitted to `/api/runs`:

1. An `AgentRun` record is created linking the run to its task and storing the prompt, tool and raw response.
2. The built‑in evaluation heuristics run against the prompt/response pair.  Each check produces an `Evaluation` record with pass/fail status, a score (1 or 0) and an optional reason.  The checks include missing report sections, destructive commands, secret exposure, migrations/upgrades and scope drift detection.
3. A stubbed Langfuse trace is created.  Both the prompt and response are logged via `logObservation`.  The current implementation prints to the console; when Langfuse keys are configured the helper can be updated to send HTTP requests.

The page lists all previous runs with their responses and evaluation outcomes.

### Approval Gates

If a task has `approvalRequired = true`, an **Approval** panel appears.  Approvers can approve or reject the task.  This action updates an `Approval` record and sets the task’s status to either `approved` or `rejected`.  Approvals are stored in the database for auditability.

### Dashboard

The root page (`/`) summarises high‑level metrics: total tasks, counts by status, pending approvals, failed evaluations and the five most recent agent runs.  Each run links back to its task detail page.  The dashboard queries the database server‑side using Prisma.

### Task List

The `/tasks` page lists all tasks with their status, agent tool and creation date.  It includes a shortcut to create new tasks.

### Database Schema

Prisma models capture the minimum entities required for Phase 1, including tasks, runs, evaluations, approvals and audit logs.  The schema is forward‑compatible with additional features such as user accounts, projects, prompt templates and more granular audit events.

### Security Posture

* **No secrets stored:** API keys for Langfuse, Promptfoo and LLM providers live only in environment variables.
* **Manual execution:** The orchestrator never executes shell commands.  All agent outputs are untrusted and require human copy/paste.
* **Approval gates:** Potentially dangerous actions (production deploys, database changes, destructive commands) cannot be committed without human approval.  Future phases should implement automatic detection and enforcement of these gates.
* **Audit trail:** All tasks, runs, evaluations and approvals are persisted.  Although not yet exposed via a dedicated UI, the data model supports building an audit dashboard in future iterations.

## Limitations and Stubs

* **Open SWE integration** is only a placeholder.  The `submitToOpenSwe` function currently returns a message directing users to run prompts manually.  A real implementation would package the prompt and context into a request to Open SWE’s agent harness and stream back the response.
* **Langfuse logging** writes only to the console.  To enable real tracing, set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL` in `.env`, then update `src/lib/langfuse.ts` to POST to the appropriate endpoints.
* **Promptfoo evaluation** is not used.  Evaluations are performed by a custom heuristic evaluator.  When ready, import `promptfoo` and call its `evaluate` API with a test suite defined in YAML or JSON.
* **Authentication** is not implemented.  All users share the same session; there is no notion of roles or permissions.  Phase 2 should introduce a simple auth layer and enforce least‑privilege access.

## Setup & Running

See `README.md` for full setup instructions.  In summary:

1. Install Node.js and Docker.
2. Run `docker-compose up -d` to start PostgreSQL.
3. Create `.env` from `.env.example` and set `DATABASE_URL` and optional integration keys.
4. Run `npm install` to install dependencies.
5. Apply the database schema with `npx prisma migrate dev --name init`.
6. Start the development server with `npm run dev` and browse to `http://localhost:3000`.

## Risks and Future Work

| Risk / Limitation | Mitigation / Future Work |
|---|---|
| **Manual process slows adoption** | Integrate with Open SWE’s API to automatically dispatch prompts and fetch responses. |
| **Evaluation heuristics are simplistic** | Replace with Promptfoo’s evaluators or bespoke checks built on LLM graders. |
| **No authentication or permissions** | Introduce user accounts (e.g. using NextAuth.js) and restrict actions by role. |
| **Sensitive data in logs** | Redact secrets before logging and adopt tokenisation for PII. |
| **No sandboxed execution** | Use Open SWE’s sandbox providers or containerised runners to safely execute agent code. |
| **Lack of testing and linting** | Add ESLint configuration, unit tests and end‑to‑end tests to ensure quality. |
| **Unimplemented audit UI** | Build a dedicated audit dashboard showing prompts, responses, evaluation failures and approval history. |

## Conclusion

This Phase 1 delivery establishes a foundation for an AI‑assisted software development orchestration tool without compromising on safety.  It demonstrates how tasks can be collected, prompts generated, runs recorded, basic evaluations performed and approvals enforced.  The architecture is designed to be modular and extensible: Open SWE, Langfuse and Promptfoo integrations are stubbed in a way that makes upgrading straightforward.  The next phase can focus on deepening these integrations, adding authentication and enhancing the user experience.