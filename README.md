# AI Dev Orchestrator (Phase 1 MVP)

This repository implements a minimal internal orchestration layer for AI‑assisted software development.  The goal of the Phase 1 MVP is to streamline repetitive prompt–response workflows while enforcing safety controls and providing rich auditability.  It integrates loosely with **Open SWE**, **Langfuse** and **Promptfoo** via adapters and stubs, leaving room for deeper integration in future phases.

## Features

* **Task intake** – collect a title, raw instruction, agent/tool selection, risk level, environment and approval requirement.
* **Prompt builder** – generate a structured execution prompt with sections for objective, scope, safety constraints, validation commands and a required final report format.
* **Agent run record** – store generated prompts, responses, selected tool, evaluation results and timestamps.  Manual copy/paste is used for agent responses in this MVP.
* **Heuristic evaluation** – basic checks for missing report sections, destructive commands, secret exposure, migrations/upgrades and scope drift.  Implemented via `src/lib/promptEvaluator.ts`.
* **Langfuse trace stubs** – helpers to create and log traces; currently log to the console.  Replace with real API calls by filling in `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL` in your `.env` file.
* **Approval gates** – tasks flagged as requiring approval can be approved or rejected via the UI.  Approval status is stored in the database and reflected in the task status.  In Phase 1 these approvals only gate workflow inside this orchestrator; external coding agents must still be run manually.
* **Audit dashboard** – the dashboard shows summary counts of tasks by status, pending approvals, failed evaluations and recent runs.  Additional audit details are stored in the `AuditLog` table for future expansion.

## Project Structure

```
ai-dev-orchestrator/
├── docker-compose.yml      # Local PostgreSQL service
├── prisma/
│   └── schema.prisma        # Database models
├── src/
│   ├── app/                # Next.js app router
│   │   ├── layout.tsx       # Global layout and header
│   │   ├── page.tsx         # Dashboard page
│   │   ├── tasks/
│   │   │   ├── page.tsx     # Task list page
│   │   │   ├── new/page.tsx # Task intake page
│   │   │   └── [id]/page.tsx# Task detail page
│   │   └── api/
│   │       ├── tasks/route.ts     # API routes for tasks
│   │       ├── runs/route.ts      # API routes for agent runs and evaluation
│   │       └── approvals/route.ts # API routes for approvals
│   ├── components/
│   │   ├── RunPromptPanel.tsx   # Client component for submitting responses
│   │   ├── EvaluationList.tsx   # Display evaluation results
│   │   └── ApprovalPanel.tsx    # Approve/reject tasks
│   └── lib/
│       ├── prisma.ts            # Prisma client instance
│       ├── promptBuilder.ts     # Prompt construction helper
│       ├── promptEvaluator.ts   # Basic evaluation heuristics
│       ├── langfuse.ts          # Stubbed Langfuse client
│       └── openSweAdapter.ts    # Placeholder Open SWE adapter
├── .env.example          # Environment variable template
├── next.config.js        # Minimal Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── README.md
```

## Prerequisites

* **Node.js 20+** – install from [nodejs.org](https://nodejs.org/).  The project uses the latest stable release and TypeScript.
* **Docker** – used to run PostgreSQL locally.  Make sure Docker Desktop or the Docker engine is installed and running.

## Setup

1. **Clone the repository** and install dependencies:

   ```bash
   git clone <this-repo-url>
   cd ai-dev-orchestrator
   npm install
   ```

2. **Start the database** (optional):

   If you prefer to run PostgreSQL via Docker Compose, run:

   ```bash
   docker-compose up -d
   ```

   This will launch a PostgreSQL 15 instance on port 5432 with the database name `aidv` and credentials `postgres`/`postgres`.  When using this container, set `DATABASE_URL` to `postgresql://postgres:postgres@db:5432/aidv?schema=public`.

   If you already have PostgreSQL running on your local machine, simply set `DATABASE_URL` to use `localhost` instead of `db` in your `.env` file (e.g. `postgresql://postgres:postgres@localhost:5432/aidv?schema=public`).

3. **Configure environment variables:**

   Copy `.env.example` to `.env` and customise the values.  At minimum you need to set `DATABASE_URL`.  Leave the Langfuse and Promptfoo keys blank in Phase 1 unless you have them.

   ```bash
   cp .env.example .env
   # then edit .env with your favourite editor
   ```

4. **Generate the Prisma client and apply migrations:**

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

   This will create the required tables in the database defined in your `.env` file and generate a typed client under `node_modules/@prisma/client`.

5. **Run the development server:**

   ```bash
   npm run dev
   ```

   Navigate to `http://localhost:3000` in your browser.  You should see the dashboard.  Use the **Tasks** link to create your first task.

## Usage

1. **Create a new task:** Fill in the title and raw instruction along with the desired agent/tool, risk level, environment and approval requirement.  In Phase 1 a default project will be created automatically if none exists, so you do not need to specify a project ID.
2. **Generate the prompt:** Navigate to the task detail page.  The generated system prompt appears in the **Generated Prompt** section.  Click **Copy Prompt** to copy it to your clipboard.
3. **Run the agent manually:** Paste the prompt into your preferred coding agent (e.g. Claude Code, Codex, OpenClaw) and let it execute.  Copy the entire agent output.
4. **Record the run:** Paste the agent output into the **New Agent Run** panel and submit.  The system will store the response, run basic evaluation checks and log traces to Langfuse (currently a stub).  Evaluation results appear below the response.
5. **Approve or reject:** If approval is required for the task, use the **Approval** panel to approve or reject the run.  Approvals update the task status accordingly.

## Langfuse Integration

This MVP includes a stubbed Langfuse client.  To enable real trace logging:

1. Create an account at [Langfuse](https://cloud.langfuse.com) or self‑host it.
2. Obtain your **public key**, **secret key** and **base URL** from the project settings.
3. Populate `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL` in your `.env` file.
4. Replace the stubbed implementations in `src/lib/langfuse.ts` with real `fetch` calls against the Langfuse HTTP API.  Consult the [Get Started](https://langfuse.com/docs/observability/get-started) guide for payload details.  Ensure that prompts, responses and evaluation metadata are redacted before logging when necessary.

## Open SWE Integration

The `src/lib/openSweAdapter.ts` file defines a placeholder function, `submitToOpenSwe`, which returns a stub response instructing the user to run the prompt manually.  Future phases should implement integration with Open SWE’s API or CLI:

* Identify the appropriate entry point (e.g. `create_deep_agent` function) in the [Open SWE repository](https://github.com/langchain-ai/open-swe) and determine how to submit tasks programmatically.
* Package the system prompt, project details and tool selection into a request to Open SWE.
* Capture the agent’s output, file diffs, commands and commit hashes and propagate them back to the orchestrator.

Do **not** claim that the integration is complete until the agent can run end‑to‑end and return a response without manual copy/paste.

## Promptfoo Integration

Promptfoo provides a comprehensive evaluation and red‑teaming framework.  In this MVP we implement a handful of heuristic checks directly in `src/lib/promptEvaluator.ts`.  When you’re ready to adopt Promptfoo:

1. Install the `promptfoo` package (already declared in `package.json`).
2. Define a test suite configuration that captures your desired checks (scope drift, missing tests, destructive commands, etc.).  See the [Promptfoo documentation](https://www.promptfoo.dev) for examples.
3. Invoke the evaluation at runtime within `POST /api/runs` using `import promptfoo` and the `evaluate` function.  Store the results in the `Evaluation` table and display them via the UI.

## Security Considerations

The following security rules are enforced or stubbed in Phase 1:

* **No secrets stored in the database.** API keys must be provided via environment variables and redacted from logs.  The application never writes secret values to the database.
* **Manual execution only.** Agents are untrusted.  Automatic shell command execution is out of scope for the MVP.  Future phases must implement sandboxing and permissions when enabling automatic runs.
* **Approval gates.** Actions that modify production systems or perform destructive operations are blocked within this orchestrator until explicitly approved via the UI.  External agent tools are still operated manually in Phase 1, so approvals in the app do not automatically prevent actions taken outside of it.
* **Audit trail.** Every run, evaluation, approval and task creation event is stored in the database.  This can be surfaced in more detail on an audit dashboard in later phases.

## Next Steps

* Implement real Open SWE invocation in `openSweAdapter.ts`.
* Replace stubbed Langfuse calls with real HTTP requests.
* Introduce authentication and user accounts.
* Flesh out project management (create/list projects) and permissions per environment.
* Expand evaluation logic with Promptfoo or your own evaluators.
* Build additional UI components (search, filtering, audit log viewer, report export).

## License

This project is distributed under the MIT license.  See `LICENSE` for details.