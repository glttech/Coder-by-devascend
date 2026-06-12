// Demo seed script — creates sample data for local exploration.
// Safe to run multiple times (idempotent). Does not overwrite existing data.
// Usage: npm run seed:demo
// Requires: DATABASE_URL set in environment

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotency check — bail out early if demo data already exists.
  const existing = await prisma.project.findFirst({
    where: { name: "Demo Project" },
  });

  if (existing) {
    console.log(
      "Demo data already exists. Run 'prisma migrate reset' to start fresh."
    );
    process.exit(0);
  }

  // ── 1. Project ────────────────────────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      name: "Demo Project",
      description: "Sample project for exploring the tool",
      repoOwner: "example",
      repoName: "demo-repo",
      defaultBranch: "main",
    },
  });

  // ── 2. Task ───────────────────────────────────────────────────────────────
  const task = await prisma.task.create({
    data: {
      title: "Review AI-generated auth middleware",
      instruction:
        "The AI was asked to refactor the login middleware to use JWT tokens. " +
        "Review the suggested change and approve or block it.",
      projectId: project.id,
      agentTool: "claude-code-manual",
      riskLevel: "medium",
      environment: "dev",
      status: "pending",
      approvalRequired: true,
    },
  });

  // ── 3. Instruction ────────────────────────────────────────────────────────
  const instruction = await prisma.instruction.create({
    data: {
      taskId: task.id,
      title: "Refactor auth middleware to JWT",
      body:
        "Replace the existing session-cookie auth flow in `middleware/auth.ts` " +
        "with stateless JWT verification. Use the `jsonwebtoken` library already " +
        "present in the project. Ensure all existing tests continue to pass.",
      status: "pending_approval",
    },
  });

  // ── 4. AuditLog entries ───────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      taskId: task.id,
      event: "task_created",
      details: `Demo task "${task.title}" created by seed script.`,
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task.id,
      instructionId: instruction.id,
      event: "instruction_created",
      details: `Demo instruction "${instruction.title}" created by seed script.`,
    },
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("✓ Demo data created successfully!");
  console.log("");
  console.log("What was created:");
  console.log('  - 1 project: "Demo Project"');
  console.log(`  - 1 task: "Review AI-generated auth middleware" (medium risk, approval required)`);
  console.log("  - 1 pending AI suggestion awaiting your review");
  console.log("");
  console.log("What to do next:");
  console.log("  1. Visit the dashboard:        http://localhost:3000/");
  console.log(`  2. Open the task:              http://localhost:3000/tasks/${task.id}`);
  console.log("  3. Review the AI suggestion:   http://localhost:3000/instructions/pending");
  console.log("  4. View the audit log:         http://localhost:3000/audit");
  console.log("");
  console.log("Tip: The task has approvalRequired=true and a pending AI suggestion.");
  console.log("     Visit the Review Queue to approve or block it.");
}

main()
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
