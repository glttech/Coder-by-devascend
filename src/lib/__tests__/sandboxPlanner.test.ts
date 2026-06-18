import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateSandboxPlan } from '../sandboxPlanner.js';

const BASE_INPUT = {
  instruction: 'Update the button label',
  riskLevel: 'low',
  environment: 'dev',
  agentTool: 'claude-code-manual',
};

describe('generateSandboxPlan — migration instruction', () => {
  test('includes migration warning when instruction contains "migration"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Run a migration to add the sandboxPlan column',
    });
    assert.ok(
      plan.warnings.some((w) => w.toLowerCase().includes('migration')),
      'should include a migration warning',
    );
  });

  test('includes migration file in plannedFiles when instruction contains "migration"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Run a migration to add the sandboxPlan column',
    });
    assert.ok(
      plan.plannedFiles.some((f) => f.includes('migration')),
      'should include migration file in plannedFiles',
    );
  });

  test('includes prisma migrate dev in plannedCommands when instruction contains "migration"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Apply the migration to the database',
    });
    assert.ok(
      plan.plannedCommands.includes('prisma migrate dev'),
      'should include "prisma migrate dev" in plannedCommands',
    );
  });
});

describe('generateSandboxPlan — production environment', () => {
  test('adds production warning when environment is "production"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      environment: 'production',
    });
    assert.ok(
      plan.warnings.some((w) => w.toLowerCase().includes('production')),
      'should include a production warning',
    );
  });

  test('sets requiresApproval to true for production environment', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      environment: 'production',
    });
    assert.equal(plan.requiresApproval, true);
  });

  test('does not add production warning for non-production environment', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      environment: 'dev',
    });
    assert.ok(
      !plan.warnings.some((w) => w.toLowerCase().includes('production')),
      'should not include production warning for dev environment',
    );
  });
});

describe('generateSandboxPlan — file path extraction', () => {
  test('includes src/*.ts path mentioned in instruction in plannedFiles', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Update the handler in src/lib/sandboxPlanner.ts to fix the bug',
    });
    assert.ok(
      plan.plannedFiles.includes('src/lib/sandboxPlanner.ts'),
      'plannedFiles should contain src/lib/sandboxPlanner.ts',
    );
  });

  test('includes src/*.tsx path mentioned in instruction in plannedFiles', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Edit src/components/SandboxPreviewPanel.tsx to add a button',
    });
    assert.ok(
      plan.plannedFiles.includes('src/components/SandboxPreviewPanel.tsx'),
      'plannedFiles should contain src/components/SandboxPreviewPanel.tsx',
    );
  });

  test('returns default placeholder when no file paths in instruction', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Update the button label',
    });
    assert.ok(
      plan.plannedFiles.includes('(files to be determined by agent)'),
      'plannedFiles should contain the default placeholder',
    );
  });
});

describe('generateSandboxPlan — summary', () => {
  test('returns a non-empty summary string', () => {
    const plan = generateSandboxPlan(BASE_INPUT);
    assert.ok(typeof plan.summary === 'string', 'summary should be a string');
    assert.ok(plan.summary.length > 0, 'summary should not be empty');
  });

  test('summary mentions the agentTool', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      agentTool: 'open-swe',
    });
    assert.ok(plan.summary.includes('open-swe'), 'summary should mention the agentTool');
  });

  test('summary mentions the environment', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      environment: 'staging',
    });
    assert.ok(plan.summary.includes('staging'), 'summary should mention the environment');
  });
});

describe('generateSandboxPlan — risk and approval', () => {
  test('sets requiresApproval to true when riskLevel is "high"', () => {
    const plan = generateSandboxPlan({ ...BASE_INPUT, riskLevel: 'high' });
    assert.equal(plan.requiresApproval, true);
  });

  test('sets requiresApproval to false when riskLevel is "low" and env is not production', () => {
    const plan = generateSandboxPlan({ ...BASE_INPUT, riskLevel: 'low', environment: 'dev' });
    assert.equal(plan.requiresApproval, false);
  });

  test('always includes npm run typecheck and npm test in plannedCommands', () => {
    const plan = generateSandboxPlan(BASE_INPUT);
    assert.ok(plan.plannedCommands.includes('npm run typecheck'));
    assert.ok(plan.plannedCommands.includes('npm test'));
  });
});

describe('generateSandboxPlan — install instruction', () => {
  test('includes npm install warning when instruction contains "install"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Install the lodash package',
    });
    assert.ok(
      plan.warnings.some((w) => w.toLowerCase().includes('package')),
      'should include a package installation warning',
    );
  });

  test('includes npm install in plannedCommands when instruction contains "install"', () => {
    const plan = generateSandboxPlan({
      ...BASE_INPUT,
      instruction: 'Install the lodash package',
    });
    assert.ok(
      plan.plannedCommands.some((c) => c.includes('npm install')),
      'should include npm install in plannedCommands',
    );
  });
});
