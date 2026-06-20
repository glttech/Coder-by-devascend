/**
 * Tests for onboarding step sequence, feature highlight counts, and navigation links.
 *
 * Uses node:test — NOT Jest. No DB or network calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline data mirroring the Getting Started page steps
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS = [
  {
    number: 1,
    title: 'Create a Project',
    href: '/projects/new',
  },
  {
    number: 2,
    title: 'Import PR History',
    href: null,
  },
  {
    number: 3,
    title: 'Create a Task',
    href: '/tasks/new',
  },
  {
    number: 4,
    title: 'Run an Agent',
    href: null,
  },
  {
    number: 5,
    title: 'Review Governance',
    href: null,
    links: ['/tasks', '/providers/scorecard', '/audit'],
  },
] as const;

// ---------------------------------------------------------------------------
// Inline data mirroring the Demo page feature highlights
// ---------------------------------------------------------------------------

const FEATURE_HIGHLIGHTS = [
  { title: 'Repository Intelligence', href: '/projects' },
  { title: 'Governance Timeline',     href: '/audit' },
  { title: 'Policy Gates',            href: '/instructions/pending' },
  { title: 'Incident Tracking',       href: '/incidents' },
  { title: 'Agent Scorecards',        href: '/providers/scorecard' },
  { title: 'Client Reports',          href: '/diagrams' },
] as const;

// ---------------------------------------------------------------------------
// Step sequence tests
// ---------------------------------------------------------------------------

describe('Onboarding step sequence', () => {
  it('has exactly 5 steps', () => {
    assert.equal(ONBOARDING_STEPS.length, 5);
  });

  it('step numbers run from 1 to 5 in order', () => {
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      assert.equal(ONBOARDING_STEPS[i].number, i + 1);
    }
  });

  it('step 1 links to /projects/new', () => {
    assert.equal(ONBOARDING_STEPS[0].href, '/projects/new');
  });

  it('step 3 links to /tasks/new', () => {
    assert.equal(ONBOARDING_STEPS[2].href, '/tasks/new');
  });

  it('step 5 includes link to /audit', () => {
    const step5 = ONBOARDING_STEPS[4];
    assert.ok('links' in step5, 'Step 5 should have multiple links');
    assert.ok(
      step5.links.includes('/audit'),
      'Step 5 links should include /audit',
    );
  });

  it('step 5 includes link to /providers/scorecard', () => {
    const step5 = ONBOARDING_STEPS[4];
    assert.ok('links' in step5);
    assert.ok(
      step5.links.includes('/providers/scorecard'),
      'Step 5 links should include /providers/scorecard',
    );
  });

  it('every step has a non-empty title', () => {
    for (const step of ONBOARDING_STEPS) {
      assert.ok(
        typeof step.title === 'string' && step.title.length > 0,
        `Step ${step.number} must have a non-empty title`,
      );
    }
  });

  it('titles are unique across steps', () => {
    const titles = ONBOARDING_STEPS.map((s) => s.title);
    const uniqueTitles = new Set(titles);
    assert.equal(
      uniqueTitles.size,
      titles.length,
      'All step titles must be unique',
    );
  });
});

// ---------------------------------------------------------------------------
// Feature highlight tests
// ---------------------------------------------------------------------------

describe('Demo page feature highlights', () => {
  it('has exactly 6 feature highlight cards', () => {
    assert.equal(FEATURE_HIGHLIGHTS.length, 6);
  });

  it('first feature links to /projects (Repository Intelligence)', () => {
    assert.equal(FEATURE_HIGHLIGHTS[0].href, '/projects');
  });

  it('includes a Governance Timeline card linking to /audit', () => {
    const card = FEATURE_HIGHLIGHTS.find((f) => f.title === 'Governance Timeline');
    assert.ok(card, 'Must have a Governance Timeline card');
    assert.equal(card!.href, '/audit');
  });

  it('includes a Policy Gates card linking to /instructions/pending', () => {
    const card = FEATURE_HIGHLIGHTS.find((f) => f.title === 'Policy Gates');
    assert.ok(card, 'Must have a Policy Gates card');
    assert.equal(card!.href, '/instructions/pending');
  });

  it('includes an Incident Tracking card', () => {
    const card = FEATURE_HIGHLIGHTS.find((f) => f.title === 'Incident Tracking');
    assert.ok(card, 'Must have an Incident Tracking card');
  });

  it('includes an Agent Scorecards card', () => {
    const card = FEATURE_HIGHLIGHTS.find((f) => f.title === 'Agent Scorecards');
    assert.ok(card, 'Must have an Agent Scorecards card');
  });

  it('all feature highlight hrefs start with /', () => {
    for (const feature of FEATURE_HIGHLIGHTS) {
      assert.ok(
        feature.href.startsWith('/'),
        `Feature "${feature.title}" href must be a root-relative path`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Navigation link correctness tests
// ---------------------------------------------------------------------------

describe('Navigation link correctness', () => {
  const NAV_ITEMS = [
    { href: '/',                     label: 'Dashboard' },
    { href: '/getting-started',      label: 'Getting Started' },
    { href: '/projects',             label: 'Projects' },
    { href: '/tasks',                label: 'Tasks' },
    { href: '/instructions/pending', label: 'Review Queue' },
    { href: '/providers/scorecard',  label: 'Scorecard' },
    { href: '/audit',                label: 'Audit Log' },
    { href: '/diagrams',             label: 'Diagrams' },
    { href: '/incidents',            label: 'Incidents' },
    { href: '/settings/billing',     label: 'Billing' },
    { href: '/settings/team',        label: 'Team' },
    { href: '/ci',                   label: 'CI Dashboard' },
    { href: '/demo',                 label: 'Demo' },
  ];

  it('sidebar includes a Getting Started link', () => {
    const item = NAV_ITEMS.find((n) => n.href === '/getting-started');
    assert.ok(item, 'Sidebar must include /getting-started');
    assert.equal(item!.label, 'Getting Started');
  });

  it('sidebar includes a Demo link', () => {
    const item = NAV_ITEMS.find((n) => n.href === '/demo');
    assert.ok(item, 'Sidebar must include /demo');
  });

  it('all nav hrefs are unique', () => {
    const hrefs = NAV_ITEMS.map((n) => n.href);
    const unique = new Set(hrefs);
    assert.equal(unique.size, hrefs.length, 'Nav hrefs must be unique');
  });

  it('all nav hrefs start with /', () => {
    for (const item of NAV_ITEMS) {
      assert.ok(
        item.href.startsWith('/'),
        `Nav item "${item.label}" href must start with /`,
      );
    }
  });
});
