import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript } from '../transcriptParser.js';

describe('parseTranscript', () => {
  test('empty string returns all-empty result', () => {
    const result = parseTranscript('');
    assert.equal(result.summary, '');
    assert.deepEqual(result.filesChanged, []);
    assert.deepEqual(result.commandsRun, []);
    assert.deepEqual(result.risksDetected, []);
    assert.equal(result.suggestedTitle, '');
  });

  test('whitespace-only string returns all-empty result', () => {
    const result = parseTranscript('   \n\n\t  ');
    assert.equal(result.summary, '');
    assert.deepEqual(result.filesChanged, []);
    assert.deepEqual(result.commandsRun, []);
    assert.deepEqual(result.risksDetected, []);
    assert.equal(result.suggestedTitle, '');
  });

  test('input with no special content returns only summary and title', () => {
    const raw = 'I reviewed the code and everything looks good. No changes were made.';
    const result = parseTranscript(raw);
    assert.ok(result.summary.length > 0);
    assert.deepEqual(result.filesChanged, []);
    assert.deepEqual(result.commandsRun, []);
    assert.deepEqual(result.risksDetected, []);
    assert.ok(result.suggestedTitle.length > 0);
  });

  test('file path extraction from plain text', () => {
    const raw = `I modified the following files:
src/app/api/tasks/route.ts
prisma/schema.prisma
src/components/MyComponent.tsx`;
    const result = parseTranscript(raw);
    assert.ok(result.filesChanged.includes('src/app/api/tasks/route.ts'), 'should detect .ts file');
    assert.ok(result.filesChanged.includes('prisma/schema.prisma'), 'should detect .prisma file');
    assert.ok(result.filesChanged.includes('src/components/MyComponent.tsx'), 'should detect .tsx file');
  });

  test('file paths inside inline backticks are NOT extracted', () => {
    const raw = 'Run `src/lib/parser.ts` to see the result. No real file was changed.';
    const result = parseTranscript(raw);
    // File inside inline code should be excluded
    assert.deepEqual(result.filesChanged, []);
  });

  test('file paths inside triple-backtick code blocks are NOT extracted', () => {
    const raw = `Here is an example:

\`\`\`
src/app/api/tasks/route.ts
src/components/Foo.tsx
\`\`\`

No actual files were changed.`;
    const result = parseTranscript(raw);
    assert.deepEqual(result.filesChanged, []);
  });

  test('command extraction from lines starting with $, >, or %', () => {
    const raw = `I ran the following:
$ npm run build
> npx prisma migrate dev
% git status`;
    const result = parseTranscript(raw);
    assert.ok(result.commandsRun.some((c) => c.startsWith('$')), 'should detect $ commands');
    assert.ok(result.commandsRun.some((c) => c.startsWith('>')), 'should detect > commands');
    assert.ok(result.commandsRun.some((c) => c.startsWith('%')), 'should detect % commands');
    assert.equal(result.commandsRun.length, 3);
  });

  test('command extraction from shell triple-backtick blocks', () => {
    const raw = `Run these commands:

\`\`\`bash
npm install
git commit -m "fix"
\`\`\``;
    const result = parseTranscript(raw);
    assert.ok(result.commandsRun.includes('npm install'), 'should extract npm install from shell block');
    assert.ok(result.commandsRun.includes('git commit -m "fix"'), 'should extract git command from shell block');
  });

  test('risk keyword detection is case-insensitive', () => {
    const raw = `I ran a Migration script.
The token is stored in the config.
Watch out for Production changes.`;
    const result = parseTranscript(raw);
    assert.ok(result.risksDetected.length >= 3, `expected >=3 risk lines, got ${result.risksDetected.length}`);
    const lower = result.risksDetected.map((r) => r.toLowerCase());
    assert.ok(lower.some((r) => r.includes('migration')));
    assert.ok(lower.some((r) => r.includes('token')));
    assert.ok(lower.some((r) => r.includes('production')));
  });

  test('risk line is added only once even when multiple keywords match', () => {
    const raw = 'This line has both password and token in it.';
    const result = parseTranscript(raw);
    // Should appear exactly once despite two keywords
    assert.equal(result.risksDetected.length, 1);
  });

  test('summary is first non-blank paragraph, capped at 200 chars', () => {
    const longPara = 'A'.repeat(250);
    const raw = `\n\n${longPara}\n\nSecond paragraph.`;
    const result = parseTranscript(raw);
    assert.equal(result.summary.length, 200);
    assert.ok(result.summary.startsWith('A'));
  });

  test('suggestedTitle is derived from first sentence, max 80 chars', () => {
    const raw = 'Fixed the login bug by correcting the validation logic. Other things were also done.';
    const result = parseTranscript(raw);
    assert.ok(result.suggestedTitle.length <= 80);
    assert.ok(result.suggestedTitle.includes('Fixed the login bug'));
  });

  test('suggestedTitle is empty when summary is empty', () => {
    const result = parseTranscript('');
    assert.equal(result.suggestedTitle, '');
  });

  test('duplicates in filesChanged are deduplicated', () => {
    const raw = `src/lib/parser.ts was changed.
Also updated src/lib/parser.ts again.`;
    const result = parseTranscript(raw);
    const count = result.filesChanged.filter((f) => f === 'src/lib/parser.ts').length;
    assert.equal(count, 1, 'duplicate file paths should be deduplicated');
  });

  test('combined real-world-like transcript', () => {
    const raw = `I completed the task successfully.

Here is what I did:
- Updated src/app/api/tasks/route.ts to add validation
- Modified prisma/schema.prisma with a new migration
- Edited src/components/TaskForm.tsx for the UI changes

Commands run:
$ npm run build
$ npx prisma migrate dev --name add_task_metadata

The .env file was NOT modified. No secrets or passwords were changed.
Be careful: this touches the production database migration path.

\`\`\`bash
npm test
\`\`\``;

    const result = parseTranscript(raw);

    // Summary should be the first paragraph
    assert.ok(result.summary.includes('I completed the task successfully'));

    // Files
    assert.ok(result.filesChanged.includes('src/app/api/tasks/route.ts'));
    assert.ok(result.filesChanged.includes('prisma/schema.prisma'));
    assert.ok(result.filesChanged.includes('src/components/TaskForm.tsx'));

    // Commands
    assert.ok(result.commandsRun.some((c) => c.includes('npm run build')));
    assert.ok(result.commandsRun.some((c) => c.includes('prisma migrate dev')));
    assert.ok(result.commandsRun.includes('npm test'));

    // Risks: migration, .env, production
    const risksLower = result.risksDetected.map((r) => r.toLowerCase());
    assert.ok(risksLower.some((r) => r.includes('migration') || r.includes('.env') || r.includes('production')));

    // Title should be short and derived from summary
    assert.ok(result.suggestedTitle.length <= 80);
    assert.ok(result.suggestedTitle.length > 0);
  });
});
