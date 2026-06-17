/**
 * Demo seed data — pure static exports, no side effects, no DB calls.
 * Three representative governance scenarios covering low / medium / high risk.
 */

export interface DemoTask {
  id: string;
  title: string;
  instruction: string;
  riskLevel: 'low' | 'medium' | 'high';
  environment: string;
  status: string;
}

export interface DemoScenario {
  task: DemoTask;
  roles: string[];
  expectedDecision: string;
  narrative: string;
}

export const DEMO_TASKS: DemoTask[] = [
  {
    id: 'demo-task-001',
    title: 'Add user avatar upload',
    instruction:
      'Allow users to upload a profile avatar (JPEG/PNG, max 2 MB). Store in object storage. Resize to 200×200 on upload. No auth changes.',
    riskLevel: 'low',
    environment: 'dev',
    status: 'PENDING',
  },
  {
    id: 'demo-task-002',
    title: 'Migrate orders table to UUID primary key',
    instruction:
      'Rename orders.id from SERIAL to UUID. Add migration to back-fill existing rows. Update foreign key references in order_items and invoices. Staging environment only.',
    riskLevel: 'medium',
    environment: 'staging',
    status: 'PENDING',
  },
  {
    id: 'demo-task-003',
    title: 'Rotate production JWT signing key',
    instruction:
      'Invalidate the current JWT_SECRET and rotate to a new 256-bit key. All active sessions will be terminated. Production deployment required within 4-hour maintenance window.',
    riskLevel: 'high',
    environment: 'production',
    status: 'PENDING',
  },
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    task: DEMO_TASKS[0],
    roles: ['product_analyst', 'developer'],
    expectedDecision: 'CONTINUE',
    narrative:
      'Low-risk feature addition reviewed by Product Analyst and Developer. Demonstrates fast-path governance: no senior approval needed, team can proceed immediately.',
  },
  {
    task: DEMO_TASKS[1],
    roles: ['architect', 'developer', 'qa'],
    expectedDecision: 'RUN_VALIDATION',
    narrative:
      'Medium-risk database migration reviewed by Architect, Developer, and QA. Demonstrates validation-gate governance: migration must be tested before staging promotion.',
  },
  {
    task: DEMO_TASKS[2],
    roles: ['security_reviewer', 'architect', 'release_manager'],
    expectedDecision: 'SENIOR_APPROVAL_REQUIRED',
    narrative:
      'High-risk production security change reviewed by Security Reviewer, Architect, and Release Manager. Demonstrates maximum-gate governance: senior human approval is mandatory before any action.',
  },
];
