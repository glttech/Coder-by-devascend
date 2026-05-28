import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResponse } from '../promptEvaluator.js';

function getResult(results: ReturnType<typeof evaluateResponse>, name: string) {
  return results.find((r) => r.name === name);
}

describe('evaluateResponse — migration-or-upgrade check', () => {
  const dummyPrompt = 'Objective: fix a bug';

  test('npm install bare does NOT flag migration-or-upgrade', () => {
    const results = evaluateResponse(dummyPrompt, 'Run npm install to restore dependencies.');
    const r = getResult(results, 'migration-or-upgrade');
    assert.ok(r, 'migration-or-upgrade check should be present');
    assert.equal(r!.passed, true, 'bare npm install should pass migration-or-upgrade');
  });

  test('npm install express flags migration-or-upgrade', () => {
    const results = evaluateResponse(dummyPrompt, 'Run npm install express to add the web framework.');
    const r = getResult(results, 'migration-or-upgrade');
    assert.ok(r, 'migration-or-upgrade check should be present');
    assert.equal(r!.passed, false, 'npm install <package> should fail migration-or-upgrade');
  });

  test('npm install to restore does NOT flag migration-or-upgrade', () => {
    const results = evaluateResponse(dummyPrompt, 'npm install to restore the node_modules folder');
    const r = getResult(results, 'migration-or-upgrade');
    assert.ok(r, 'migration-or-upgrade check should be present');
    assert.equal(r!.passed, true, '"npm install to restore" should pass migration-or-upgrade');
  });

  test('prisma migrate dev flags migration-or-upgrade', () => {
    const results = evaluateResponse(dummyPrompt, 'prisma migrate dev --name add_column');
    const r = getResult(results, 'migration-or-upgrade');
    assert.ok(r, 'migration-or-upgrade check should be present');
    assert.equal(r!.passed, false, 'prisma migrate dev should fail migration-or-upgrade');
  });

  test('npm install --save-dev flags migration-or-upgrade', () => {
    const results = evaluateResponse(dummyPrompt, 'Run npm install --save-dev jest');
    const r = getResult(results, 'migration-or-upgrade');
    assert.ok(r, 'migration-or-upgrade check should be present');
    assert.equal(r!.passed, false, 'npm install --save-dev should fail migration-or-upgrade');
  });
});

describe('evaluateResponse — required sections', () => {
  test('response with all required sections passes all section checks', () => {
    const response = `
      Summary: completed the task
      Files changed: src/app/page.tsx
      Commands run: npm run build
      Tests: all passing
      Risks: none
    `;
    const results = evaluateResponse('', response);
    for (const name of ['section-summary', 'section-files-changed', 'section-commands-run', 'section-tests', 'section-risks']) {
      const r = getResult(results, name);
      assert.ok(r, `check ${name} should be present`);
      assert.equal(r!.passed, true, `${name} should pass`);
    }
  });

  test('response missing sections fails corresponding checks', () => {
    const results = evaluateResponse('', 'I fixed the bug.');
    const r = getResult(results, 'section-summary');
    assert.ok(r, 'section-summary check should be present');
    assert.equal(r!.passed, false, 'missing summary should fail');
  });
});
