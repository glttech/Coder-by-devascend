import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWhatChanged,
  inferRiskLevel,
  extractWhyItMatters,
  extractValidationEvidence,
  extractMissingEvidence,
  scoreEvidenceQuality,
  summarisePR,
} from '../prSummary.js';

// ── extractWhatChanged ─────────────────────────────────────────────────────

describe('extractWhatChanged', () => {
  test('strips feat: prefix', () => {
    assert.equal(extractWhatChanged('feat: add project registry'), 'add project registry');
  });

  test('strips feat(scope): prefix', () => {
    assert.equal(extractWhatChanged('feat(tasks): add clone button'), 'add clone button');
  });

  test('strips fix: prefix', () => {
    assert.equal(extractWhatChanged('fix: truncate clone title to 500 chars'), 'truncate clone title to 500 chars');
  });

  test('strips chore: prefix', () => {
    assert.equal(extractWhatChanged('chore: update dependencies'), 'update dependencies');
  });

  test('preserves title with no conventional prefix', () => {
    assert.equal(extractWhatChanged('Add login page'), 'Add login page');
  });

  test('handles empty title', () => {
    assert.equal(extractWhatChanged(''), 'No title provided');
  });

  test('handles whitespace-only title', () => {
    assert.equal(extractWhatChanged('   '), 'No title provided');
  });
});

// ── inferRiskLevel ─────────────────────────────────────────────────────────

describe('inferRiskLevel — high risk', () => {
  test('auth in title → high', () => {
    assert.equal(inferRiskLevel('refactor authentication middleware', null).level, 'high');
  });

  test('secret in body → high', () => {
    assert.equal(inferRiskLevel('update config', 'rotate the api_key and update secret storage').level, 'high');
  });

  test('database migration → high', () => {
    assert.equal(inferRiskLevel('add user table migration', 'ALTER TABLE users ADD COLUMN email').level, 'high');
  });

  test('production in title → high', () => {
    assert.equal(inferRiskLevel('deploy to production', null).level, 'high');
  });

  test('security keyword → high', () => {
    assert.equal(inferRiskLevel('fix security vulnerability', null).level, 'high');
  });
});

describe('inferRiskLevel — medium risk', () => {
  test('deploy in body → medium', () => {
    assert.equal(inferRiskLevel('update CI config', 'changes the deploy pipeline for staging').level, 'medium');
  });

  test('dependency upgrade → medium', () => {
    assert.equal(inferRiskLevel('upgrade dependencies', 'bumps prisma and next.js').level, 'medium');
  });

  test('refactor → medium', () => {
    assert.equal(inferRiskLevel('refactor task creation logic', null).level, 'medium');
  });
});

describe('inferRiskLevel — low risk', () => {
  test('simple UI change → low', () => {
    const r = inferRiskLevel('add stale badge to task list', 'Adds a visual indicator for tasks not updated in 7 days. Pure UI change with no API modifications.');
    assert.equal(r.level, 'low');
  });

  test('docs change → low', () => {
    const r = inferRiskLevel('update README with setup instructions', 'Updates the README with clearer instructions.');
    assert.equal(r.level, 'low');
  });
});

describe('inferRiskLevel — unknown', () => {
  test('empty body → unknown', () => {
    const r = inferRiskLevel('add feature', null);
    assert.equal(r.level, 'unknown');
  });

  test('very short body → unknown', () => {
    const r = inferRiskLevel('fix bug', 'fixed it');
    assert.equal(r.level, 'unknown');
  });
});

// ── extractWhyItMatters ────────────────────────────────────────────────────

describe('extractWhyItMatters', () => {
  test('returns placeholder for null body', () => {
    assert.equal(extractWhyItMatters(null), 'No description provided.');
  });

  test('returns placeholder for empty body', () => {
    assert.equal(extractWhyItMatters(''), 'No description provided.');
  });

  test('extracts ## Why section', () => {
    const body = '## Summary\nDoes stuff\n\n## Why\nBecause users need it to save time.';
    const result = extractWhyItMatters(body);
    assert.ok(result.includes('users need it'));
  });

  test('extracts ## Motivation section', () => {
    const body = '## Motivation\nThis fixes a daily friction point for Rahul.';
    const result = extractWhyItMatters(body);
    assert.ok(result.includes('daily friction'));
  });

  test('falls back to first paragraph when no section', () => {
    const body = 'This PR adds a clone button so users can duplicate tasks quickly.';
    const result = extractWhyItMatters(body);
    assert.ok(result.includes('clone button'));
  });
});

// ── extractValidationEvidence ──────────────────────────────────────────────

describe('extractValidationEvidence', () => {
  test('detects "tests passing"', () => {
    const ev = extractValidationEvidence('feat: add button', '296 tests pass, build clean.');
    assert.ok(ev.some((e) => e.includes('test')));
  });

  test('detects build clean', () => {
    const ev = extractValidationEvidence('feat: add button', 'Build successful and clean.');
    assert.ok(ev.some((e) => e.includes('Build')));
  });

  test('detects test plan section', () => {
    const ev = extractValidationEvidence('feat: add button', '## Test plan\n- [ ] check it works');
    assert.ok(ev.some((e) => e.includes('Test plan')));
  });

  test('returns empty array when no evidence', () => {
    const ev = extractValidationEvidence('Update README', null);
    assert.equal(ev.length, 0);
  });
});

// ── extractMissingEvidence ─────────────────────────────────────────────────

describe('extractMissingEvidence', () => {
  test('flags TODO in body', () => {
    const m = extractMissingEvidence('feat: thing', 'TODO: add tests later');
    assert.ok(m.some((e) => e.includes('TODO')));
  });

  test('flags WIP in title', () => {
    const m = extractMissingEvidence('WIP: new feature', null);
    assert.ok(m.some((e) => e.includes('WIP')));
  });

  test('flags missing description', () => {
    const m = extractMissingEvidence('small fix', null);
    assert.ok(m.some((e) => e.includes('No PR description')));
  });

  test('flags no test confirmation when body has no test mention', () => {
    const m = extractMissingEvidence('feat: add button', 'Changes the sidebar color to blue.');
    assert.ok(m.some((e) => e.includes('test')));
  });

  test('no missing evidence for well-documented PR', () => {
    const body = '## Summary\nAdds a new feature.\n\n## Test plan\n- 296 tests pass\n- Build clean';
    const m = extractMissingEvidence('feat: add button', body);
    assert.ok(!m.some((e) => e.includes('No PR description')));
  });
});

// ── scoreEvidenceQuality ───────────────────────────────────────────────────

describe('scoreEvidenceQuality', () => {
  test('no body → missing', () => {
    assert.equal(scoreEvidenceQuality([], [], null), 'missing');
  });

  test('body too short → missing', () => {
    assert.equal(scoreEvidenceQuality([], [], 'small'), 'missing');
  });

  test('3+ positive signals → strong', () => {
    const positive = ['Tests passing', 'Build clean', 'CI passing'];
    assert.equal(scoreEvidenceQuality(positive, [], 'A well documented PR body here.'), 'strong');
  });

  test('1-2 positive signals → adequate', () => {
    assert.equal(scoreEvidenceQuality(['Tests passing'], [], 'A reasonable body here.'), 'adequate');
  });

  test('WIP in missing → weak', () => {
    assert.equal(scoreEvidenceQuality([], ['Contains TODO/WIP markers'], 'Some body text here.'), 'weak');
  });

  test('no signals → weak', () => {
    assert.equal(scoreEvidenceQuality([], [], 'A body without any evidence signals at all.'), 'weak');
  });
});

// ── summarisePR — integration ──────────────────────────────────────────────

describe('summarisePR — full integration', () => {
  test('well-documented PR produces strong summary', () => {
    const title = 'feat(tasks): staleness indicators — last activity column and stale badge';
    const body = `## Summary
- Task list: rename "Created" to "Last activity" with relative timestamps.
- Non-terminal tasks not updated in 7d show amber highlight and stale badge.

## Why
Operators need to see stuck tasks without manually checking dates.

## Test plan
- 272 tests pass
- Build clean
- CI green`;
    const s = summarisePR(title, body);
    assert.equal(typeof s.whatChanged, 'string');
    assert.ok(s.whatChanged.length > 0);
    assert.ok(s.evidenceQuality === 'strong' || s.evidenceQuality === 'adequate');
    assert.equal(s.riskLevel, 'low');
  });

  test('auth PR gets high risk level', () => {
    const s = summarisePR('refactor authentication system', 'Changes the auth middleware to use JWT tokens.');
    assert.equal(s.riskLevel, 'high');
  });

  test('empty title and body produces graceful output', () => {
    const s = summarisePR('', null);
    assert.equal(s.whatChanged, 'No title provided');
    assert.equal(s.whyItMatters, 'No description provided.');
    assert.equal(s.evidenceQuality, 'missing');
  });

  test('result has all required fields', () => {
    const s = summarisePR('add button', 'adds a button');
    assert.ok('whatChanged' in s);
    assert.ok('whyItMatters' in s);
    assert.ok('riskLevel' in s);
    assert.ok('riskReason' in s);
    assert.ok('validationEvidence' in s);
    assert.ok('missingEvidence' in s);
    assert.ok('evidenceQuality' in s);
    assert.ok(Array.isArray(s.validationEvidence));
    assert.ok(Array.isArray(s.missingEvidence));
  });
});
