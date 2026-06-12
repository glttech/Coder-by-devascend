// Demo seed script — creates rich sample data for local exploration and demos.
// Safe to run multiple times (upsert-idempotent via fixed IDs).
// Usage: npm run seed:demo
// Requires: DATABASE_URL set in environment

import { PrismaClient } from "@prisma/client";

// ── Stable IDs ──────────────────────────────────────────────────────────────
// Fixed UUIDs ensure upserts are idempotent across repeated runs.
export const DEMO_IDS = {
  // Projects
  proj1: "00000000-demo-0000-0000-000000000001",
  proj2: "00000000-demo-0000-0000-000000000002",
  // Tasks — Payments API (proj1)
  task1: "00000000-demo-0000-0000-000000000011",
  task2: "00000000-demo-0000-0000-000000000012",
  task3: "00000000-demo-0000-0000-000000000013",
  task4: "00000000-demo-0000-0000-000000000014",
  // Tasks — Auth Service (proj2)
  task5: "00000000-demo-0000-0000-000000000015",
  task6: "00000000-demo-0000-0000-000000000016",
  task7: "00000000-demo-0000-0000-000000000017",
  // AgentRuns
  run1: "00000000-demo-0000-0000-000000000021",
  run2: "00000000-demo-0000-0000-000000000022",
  run3: "00000000-demo-0000-0000-000000000023",
  run4: "00000000-demo-0000-0000-000000000024",
  run5: "00000000-demo-0000-0000-000000000025",
  run6: "00000000-demo-0000-0000-000000000026",
  // GithubPRs (no stable id field for unique lookup — use projectId_prNumber)
  pr1: "00000000-demo-0000-0000-000000000031",
  pr2: "00000000-demo-0000-0000-000000000032",
  pr3: "00000000-demo-0000-0000-000000000033",
  // Approval
  appr1: "00000000-demo-0000-0000-000000000041",
  // AuditLogs
  audit1: "00000000-demo-0000-0000-000000000051",
  audit2: "00000000-demo-0000-0000-000000000052",
  audit3: "00000000-demo-0000-0000-000000000053",
  audit4: "00000000-demo-0000-0000-000000000054",
  audit5: "00000000-demo-0000-0000-000000000055",
  audit6: "00000000-demo-0000-0000-000000000056",
};

export async function seedDemo(db: PrismaClient): Promise<void> {
  const IDS = DEMO_IDS;

  // ── 1. Projects ────────────────────────────────────────────────────────────
  await db.project.upsert({
    where: { id: IDS.proj1 },
    create: {
      id: IDS.proj1,
      name: "Payments API",
      description:
        "Core payment processing service handling Stripe webhooks, refunds, and subscription billing.",
      repoOwner: "devascend-demo",
      repoName: "payments-api",
      defaultBranch: "main",
    },
    update: {
      name: "Payments API",
      description:
        "Core payment processing service handling Stripe webhooks, refunds, and subscription billing.",
      repoOwner: "devascend-demo",
      repoName: "payments-api",
    },
  });

  await db.project.upsert({
    where: { id: IDS.proj2 },
    create: {
      id: IDS.proj2,
      name: "Auth Service",
      description:
        "Authentication and authorisation microservice — JWT issuance, session management, RBAC.",
      repoOwner: "devascend-demo",
      repoName: "auth-service",
      defaultBranch: "main",
    },
    update: {
      name: "Auth Service",
      description:
        "Authentication and authorisation microservice — JWT issuance, session management, RBAC.",
      repoOwner: "devascend-demo",
      repoName: "auth-service",
    },
  });

  // ── 2. Tasks — Payments API ────────────────────────────────────────────────
  await db.task.upsert({
    where: { id: IDS.task1 },
    create: {
      id: IDS.task1,
      title: "Migrate Stripe webhook handler to SDK v5",
      instruction:
        "The Stripe Node SDK v5 introduces breaking changes to webhook signature verification. " +
        "Update `src/webhooks/stripe.ts` to use the new `stripe.webhooks.constructEventAsync` API. " +
        "All existing tests in `tests/webhooks/` must continue to pass.",
      projectId: IDS.proj1,
      agentTool: "claude-code-manual",
      riskLevel: "medium",
      environment: "dev",
      approvalRequired: false,
      status: "completed",
    },
    update: { title: "Migrate Stripe webhook handler to SDK v5", status: "completed" },
  });

  await db.task.upsert({
    where: { id: IDS.task2 },
    create: {
      id: IDS.task2,
      title: "Add idempotency key support to charge endpoint",
      instruction:
        "POST /v1/charges currently allows duplicate charges if the client retries. " +
        "Add Stripe idempotency key passthrough so retries within 24 h return the cached response. " +
        "Update the OpenAPI spec and integration tests.",
      projectId: IDS.proj1,
      agentTool: "open-swe",
      riskLevel: "low",
      environment: "staging",
      approvalRequired: false,
      status: "running",
    },
    update: { title: "Add idempotency key support to charge endpoint", status: "running" },
  });

  await db.task.upsert({
    where: { id: IDS.task3 },
    create: {
      id: IDS.task3,
      title: "Refund flow: handle partial refunds on split-capture",
      instruction:
        "When a charge uses split-capture, partial refunds currently throw a 500 because the " +
        "refund amount validation checks the total capture rather than the uncaptured remainder. " +
        "Fix the validation logic and add a regression test.",
      projectId: IDS.proj1,
      agentTool: "claude-code-manual",
      riskLevel: "high",
      environment: "production",
      approvalRequired: true,
      status: "pending",
    },
    update: { title: "Refund flow: handle partial refunds on split-capture", status: "pending" },
  });

  await db.task.upsert({
    where: { id: IDS.task4 },
    create: {
      id: IDS.task4,
      title: "Add Prometheus metrics to payment processor",
      instruction:
        "Instrument the payment processor with Prometheus counters and histograms for " +
        "charge latency, webhook processing time, and error rates. " +
        "Expose metrics on /metrics behind an internal network ACL.",
      projectId: IDS.proj1,
      agentTool: "open-swe",
      riskLevel: "low",
      environment: "dev",
      approvalRequired: false,
      status: "failed",
    },
    update: { title: "Add Prometheus metrics to payment processor", status: "failed" },
  });

  // ── 3. Tasks — Auth Service ────────────────────────────────────────────────
  await db.task.upsert({
    where: { id: IDS.task5 },
    create: {
      id: IDS.task5,
      title: "Replace session cookies with short-lived JWTs",
      instruction:
        "The current auth flow uses iron-session cookies. Migrate to short-lived JWTs " +
        "(15 min access token + 7 day refresh token). Update all protected API routes to " +
        "validate the Bearer token. Keep backward-compat shim for 30 days.",
      projectId: IDS.proj2,
      agentTool: "claude-code-manual",
      riskLevel: "high",
      environment: "staging",
      approvalRequired: true,
      status: "pending",
    },
    update: { title: "Replace session cookies with short-lived JWTs", status: "pending" },
  });

  await db.task.upsert({
    where: { id: IDS.task6 },
    create: {
      id: IDS.task6,
      title: "Add PKCE support to OAuth2 authorization code flow",
      instruction:
        "RFC 7636 PKCE must be enforced for all public clients. " +
        "Update the authorization endpoint to require code_challenge and code_challenge_method. " +
        "Add server-side code_verifier validation in the token endpoint.",
      projectId: IDS.proj2,
      agentTool: "open-swe",
      riskLevel: "medium",
      environment: "dev",
      approvalRequired: false,
      status: "completed",
    },
    update: { title: "Add PKCE support to OAuth2 authorization code flow", status: "completed" },
  });

  await db.task.upsert({
    where: { id: IDS.task7 },
    create: {
      id: IDS.task7,
      title: "Implement brute-force protection on /token endpoint",
      instruction:
        "The /token endpoint has no rate limiting, making it vulnerable to credential stuffing. " +
        "Add a sliding-window rate limiter (10 req / min per IP, 50 req / min per client_id). " +
        "Return 429 with Retry-After header when limits are exceeded.",
      projectId: IDS.proj2,
      agentTool: "claude-code-manual",
      riskLevel: "medium",
      environment: "dev",
      approvalRequired: false,
      status: "running",
    },
    update: { title: "Implement brute-force protection on /token endpoint", status: "running" },
  });

  // ── 4. AgentRuns ──────────────────────────────────────────────────────────
  await db.agentRun.upsert({
    where: { id: IDS.run1 },
    create: {
      id: IDS.run1,
      taskId: IDS.task1,
      generatedPrompt:
        "You are refactoring a Node.js service. Migrate `stripe.webhooks.constructEvent` calls " +
        "in `src/webhooks/stripe.ts` to the async variant `constructEventAsync`. " +
        "Preserve all error handling and ensure the function signature stays compatible.",
      selectedTool: "claude-code-manual",
      response:
        "Updated `src/webhooks/stripe.ts` — replaced all 3 synchronous `constructEvent` calls " +
        "with `await constructEventAsync(...)`. Added `async` to the handler function. " +
        "All 12 webhook tests pass.",
      status: "succeeded",
      startedAt: new Date("2026-06-10T09:15:00Z"),
      endedAt: new Date("2026-06-10T09:22:00Z"),
    },
    update: { status: "succeeded" },
  });

  await db.agentRun.upsert({
    where: { id: IDS.run2 },
    create: {
      id: IDS.run2,
      taskId: IDS.task1,
      generatedPrompt:
        "Review the migration done in the previous run. Confirm no edge cases were missed, " +
        "specifically around webhook signature failures and timeout handling.",
      selectedTool: "claude-code-manual",
      response:
        "Reviewed the diff. Found that the error path in the 408 timeout handler still uses " +
        "the synchronous variant. Fixed the remaining call. All tests still pass.",
      status: "succeeded",
      startedAt: new Date("2026-06-10T10:00:00Z"),
      endedAt: new Date("2026-06-10T10:05:00Z"),
    },
    update: { status: "succeeded" },
  });

  await db.agentRun.upsert({
    where: { id: IDS.run3 },
    create: {
      id: IDS.run3,
      taskId: IDS.task4,
      generatedPrompt:
        "Add prom-client instrumentation to `src/processors/payment.ts`. " +
        "Create counters for `payments_total` (labels: status, method) and a histogram for " +
        "`payment_processing_duration_seconds` with buckets [0.1, 0.5, 1, 2, 5].",
      selectedTool: "open-swe",
      response:
        "Encountered a type error: `prom-client` is not installed in the project. " +
        "Attempted `npm install prom-client` but the CI sandbox does not allow network access. " +
        "Task cannot proceed without the dependency.",
      status: "failed",
      startedAt: new Date("2026-06-11T14:30:00Z"),
      endedAt: new Date("2026-06-11T14:32:00Z"),
    },
    update: { status: "failed" },
  });

  await db.agentRun.upsert({
    where: { id: IDS.run4 },
    create: {
      id: IDS.run4,
      taskId: IDS.task6,
      generatedPrompt:
        "Implement PKCE support in the OAuth2 authorization endpoint. " +
        "Accept `code_challenge` (S256 or plain) and `code_challenge_method` query params. " +
        "Store the challenge alongside the authorization code. Validate in /token.",
      selectedTool: "open-swe",
      response:
        "Updated `src/oauth/authorize.ts` and `src/oauth/token.ts`. Added S256 and plain method " +
        "support. Stored challenge in Redis with the auth code TTL. 8 new tests added, all pass.",
      status: "succeeded",
      startedAt: new Date("2026-06-09T11:00:00Z"),
      endedAt: new Date("2026-06-09T11:45:00Z"),
    },
    update: { status: "succeeded" },
  });

  await db.agentRun.upsert({
    where: { id: IDS.run5 },
    create: {
      id: IDS.run5,
      taskId: IDS.task7,
      generatedPrompt:
        "Implement sliding-window rate limiting on POST /token. Use Redis with the key pattern " +
        "`ratelimit:token:{ip}` and `ratelimit:token:{client_id}`. " +
        "Limits: 10/min per IP, 50/min per client_id. Return 429 + Retry-After header.",
      selectedTool: "claude-code-manual",
      response: null,
      status: "pending",
      startedAt: new Date("2026-06-12T08:00:00Z"),
    },
    update: { status: "pending" },
  });

  await db.agentRun.upsert({
    where: { id: IDS.run6 },
    create: {
      id: IDS.run6,
      taskId: IDS.task2,
      generatedPrompt:
        "Add idempotency key support to POST /v1/charges. Extract `Idempotency-Key` header, " +
        "hash it, and use it as the Stripe API idempotency key. Cache responses for 24 h.",
      selectedTool: "open-swe",
      response: null,
      status: "running",
      startedAt: new Date("2026-06-12T09:30:00Z"),
    },
    update: { status: "running" },
  });

  // ── 5. GithubPRs ──────────────────────────────────────────────────────────
  await db.githubPR.upsert({
    where: { projectId_prNumber: { projectId: IDS.proj1, prNumber: 47 } },
    create: {
      id: IDS.pr1,
      projectId: IDS.proj1,
      prNumber: 47,
      title: "feat: migrate Stripe webhook handler to SDK v5",
      body: "Closes #42. Migrates `constructEvent` to `constructEventAsync` across all webhook handlers. 12/12 tests pass.",
      author: "claude-bot",
      sourceBranch: "feat/stripe-sdk-v5",
      baseBranch: "main",
      state: "merged",
      merged: true,
      mergeSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      labels: ["ai-generated", "webhooks"],
      filesChangedCount: 3,
      filesChanged: [
        "src/webhooks/stripe.ts",
        "tests/webhooks/stripe.test.ts",
        "CHANGELOG.md",
      ],
      ciStatus: "success",
      prUrl: "https://github.com/devascend-demo/payments-api/pull/47",
      githubCreatedAt: new Date("2026-06-10T09:30:00Z"),
      githubUpdatedAt: new Date("2026-06-10T12:00:00Z"),
      githubMergedAt: new Date("2026-06-10T12:00:00Z"),
    },
    update: { title: "feat: migrate Stripe webhook handler to SDK v5", state: "merged" },
  });

  await db.githubPR.upsert({
    where: { projectId_prNumber: { projectId: IDS.proj1, prNumber: 51 } },
    create: {
      id: IDS.pr2,
      projectId: IDS.proj1,
      prNumber: 51,
      title: "feat: add idempotency key support to charge endpoint",
      body: "Passes `Idempotency-Key` header through to Stripe. Caches responses for 24 h to prevent duplicate charges on client retries.",
      author: "claude-bot",
      sourceBranch: "feat/idempotency-keys",
      baseBranch: "main",
      state: "open",
      merged: false,
      labels: ["ai-generated", "payments"],
      filesChangedCount: 5,
      filesChanged: [
        "src/routes/charges.ts",
        "src/middleware/idempotency.ts",
        "tests/charges.test.ts",
        "openapi.yaml",
        "CHANGELOG.md",
      ],
      ciStatus: "pending",
      prUrl: "https://github.com/devascend-demo/payments-api/pull/51",
      githubCreatedAt: new Date("2026-06-12T09:35:00Z"),
      githubUpdatedAt: new Date("2026-06-12T09:35:00Z"),
    },
    update: { title: "feat: add idempotency key support to charge endpoint", ciStatus: "pending" },
  });

  await db.githubPR.upsert({
    where: { projectId_prNumber: { projectId: IDS.proj2, prNumber: 33 } },
    create: {
      id: IDS.pr3,
      projectId: IDS.proj2,
      prNumber: 33,
      title: "feat: add PKCE support to OAuth2 authorization code flow",
      body: "Implements RFC 7636 PKCE. Enforces S256 for public clients. Stores challenge in Redis alongside auth code. Validates in /token.",
      author: "claude-bot",
      sourceBranch: "feat/pkce-support",
      baseBranch: "main",
      state: "merged",
      merged: true,
      mergeSha: "b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3",
      labels: ["ai-generated", "security", "oauth2"],
      filesChangedCount: 6,
      filesChanged: [
        "src/oauth/authorize.ts",
        "src/oauth/token.ts",
        "src/oauth/pkce.ts",
        "tests/oauth/pkce.test.ts",
        "tests/oauth/token.test.ts",
        "CHANGELOG.md",
      ],
      ciStatus: "success",
      prUrl: "https://github.com/devascend-demo/auth-service/pull/33",
      githubCreatedAt: new Date("2026-06-09T11:50:00Z"),
      githubUpdatedAt: new Date("2026-06-09T15:00:00Z"),
      githubMergedAt: new Date("2026-06-09T15:00:00Z"),
    },
    update: { title: "feat: add PKCE support to OAuth2 authorization code flow", state: "merged" },
  });

  // ── 6. Approval (high-risk task, pending) ─────────────────────────────────
  // Only upsert if the task doesn't already have an approval (unique constraint on taskId)
  const existingApproval = await db.approval.findUnique({ where: { taskId: IDS.task3 } });
  if (!existingApproval) {
    await db.approval.create({
      data: {
        id: IDS.appr1,
        taskId: IDS.task3,
        approverId: null,
        approved: null,
      },
    });
  }

  // ── 7. AuditLog entries ───────────────────────────────────────────────────
  const audits = [
    {
      id: IDS.audit1,
      taskId: IDS.task1,
      agentRunId: null,
      event: "task.created",
      details: "Task 'Migrate Stripe webhook handler to SDK v5' created via demo seed.",
      createdAt: new Date("2026-06-10T09:00:00Z"),
    },
    {
      id: IDS.audit2,
      taskId: IDS.task1,
      agentRunId: IDS.run1,
      event: "agent_run.started",
      details: "Agent run started for task 'Migrate Stripe webhook handler to SDK v5'.",
      createdAt: new Date("2026-06-10T09:15:00Z"),
    },
    {
      id: IDS.audit3,
      taskId: IDS.task1,
      agentRunId: IDS.run1,
      event: "agent_run.completed",
      details: "Agent run completed successfully. 12 tests pass.",
      createdAt: new Date("2026-06-10T09:22:00Z"),
    },
    {
      id: IDS.audit4,
      taskId: IDS.task3,
      agentRunId: null,
      event: "task.created",
      details:
        "High-risk task 'Refund flow: handle partial refunds on split-capture' created. Approval required.",
      createdAt: new Date("2026-06-11T10:00:00Z"),
    },
    {
      id: IDS.audit5,
      taskId: IDS.task3,
      agentRunId: null,
      event: "approval.requested",
      details: "Approval requested for high-risk task in production environment.",
      createdAt: new Date("2026-06-11T10:01:00Z"),
    },
    {
      id: IDS.audit6,
      taskId: IDS.task5,
      agentRunId: null,
      event: "approval.requested",
      details: "Approval requested for high-risk JWT migration task in staging environment.",
      createdAt: new Date("2026-06-12T08:30:00Z"),
    },
  ];

  for (const audit of audits) {
    await db.auditLog.upsert({
      where: { id: audit.id },
      create: audit,
      update: {},
    });
  }
}

async function main() {
  const client = new PrismaClient();
  try {
    console.log("Seeding demo data...");
    await seedDemo(client);
    console.log("");
    console.log("Demo data seeded successfully!");
    console.log("");
    console.log("What was created (idempotent — safe to re-run):");
    console.log("  Projects:    Payments API, Auth Service");
    console.log("  Tasks:       7 tasks with varied risk levels and statuses");
    console.log("  Agent Runs:  6 runs (succeeded, failed, running, pending)");
    console.log("  GitHub PRs:  3 PRs (2 merged, 1 open with CI pending)");
    console.log("  Approvals:   1 pending approval for a high-risk production task");
    console.log("  Audit Logs:  6 entries covering task lifecycle events");
    console.log("");
    console.log("Explore at:");
    console.log("  Dashboard:      http://localhost:3000/");
    console.log("  Projects:       http://localhost:3000/projects");
    console.log("  Tasks:          http://localhost:3000/tasks");
    console.log("  Review Queue:   http://localhost:3000/instructions/pending");
    console.log("  Audit Log:      http://localhost:3000/audit");
    console.log("  Demo Page:      http://localhost:3000/demo");
  } catch (err) {
    console.error("Seed script failed:", err);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

// Only run when executed directly (not when imported as a module).
// tsx sets import.meta.url to the file path of the main module.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('seed-demo.ts') || process.argv[1].endsWith('seed-demo.js'));

if (isMain) {
  main();
}
