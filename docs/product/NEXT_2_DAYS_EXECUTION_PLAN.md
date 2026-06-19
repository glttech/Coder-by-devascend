# Next 2 Days Execution Plan — Phase 3 PR Intelligence Sprint

**Sprint start:** 2026-06-18  
**Sprint end:** 2026-06-19 (EOD)  
**Branch:** feature/phase3-pr-intelligence  
**PR target:** #175  

---

## Sprint Goal

Ship the Repository Intelligence page and Governance Timeline page alongside a complete, honest documentation and scripting layer. Leave the codebase in a state where Rahul can confidently deploy to DEV and hand off to any contributor.

---

## Phase A — Discovery (DONE)

**What was done:**

- [x] Read all existing docs (`ROADMAP.md`, `PRODUCT_VISION.md`, `PRODUCT_POSITIONING.md`, `CURRENT_STATE_AUDIT.md`, `MVP_BACKLOG.md`)
- [x] Audited actual source tree: API routes, page routes, components, lib modules
- [x] Read `featureFlags.ts` to confirm active feature flags
- [x] Confirmed which migrations are in place (`prisma/migrations/` listing)
- [x] Verified which Phase 3 features are built vs. being built vs. planned
- [x] Identified the `FullSyncButton` component, `buildTimeline.ts`, `prClassifier.ts`, intelligence + governance-timeline routes

**Key findings from discovery:**

- The intelligence API (`GET /api/projects/[id]/intelligence`) is complete — queries PR stats, classification breakdown, sync state, recent activity
- The governance-timeline API (`GET /api/projects/[id]/governance-timeline`) is complete — aggregates PRs + agent runs + incidents + audit events, newest-first, capped at 100 items
- The `FullSyncButton` component is complete and tested
- UI pages for intelligence and governance timeline are in progress (the timeline page shell exists at `src/app/projects/[id]/timeline/page.tsx`)
- Feature flag `FEATURE_SANDBOX_MODE` is wired in `featureFlags.ts`
- `FEATURE_REPO_MEMORY_LLM` is referenced in source comments but not yet in `featureFlags.ts` — needs adding if LLM summary route is implemented

**Decided autonomously (no Rahul approval needed):**
- Content and structure of all docs in `docs/product/` and `docs/runbooks/`
- Content and logic of all scripts in `scripts/dev/`
- Which features to list as Built vs. Partial vs. Planned (based on actual source inspection)

---

## Phase B — Backend: Intelligence API + Governance Timeline API (DONE)

Both APIs were built as part of the branch. No additional backend work required for the 2-day sprint.

**Completed:**
- [x] `GET /api/projects/[id]/intelligence` — PR stats, classification breakdown, sync state, recent PRs
- [x] `GET /api/projects/[id]/governance-timeline` — unified timeline: PRs + agent runs + incidents + audit events
- [x] `POST /api/github-prs/sync` with `fullSync` parameter support
- [x] `src/lib/buildTimeline.ts` — timeline grouping logic (week/day/milestone)
- [x] `src/lib/projectIntelligence.ts` (or equivalent in the intelligence route) — aggregate queries

---

## Phase C — UI: Intelligence Page + Governance Timeline Page + FullSyncButton (IN PROGRESS)

**Status as of sprint start:**

| Item | Status |
|------|--------|
| `FullSyncButton` component | DONE |
| Governance Timeline page shell | DONE (page.tsx exists) |
| Repository Intelligence UI | In progress |
| Governance Timeline full UI | In progress |

**Remaining UI work (Day 1 afternoon + Day 2 morning):**

- [ ] Repository Intelligence page — wire up `GET /api/projects/[id]/intelligence`, render PR stats cards, classification breakdown, sync state, recent activity list
- [ ] Governance Timeline page — wire up `GET /api/projects/[id]/governance-timeline`, render timeline grouped by week, with event type icons and severity badges
- [ ] Add `FullSyncButton` to the project PRs tab (if not already wired)
- [ ] Navigation: ensure both pages are reachable from project detail nav

**Acceptance criteria for Phase C:**
- Intelligence page loads without error for a project with imported PRs
- Timeline page shows at minimum 3 event types (PRs, agent runs, incidents)
- `FullSyncButton` triggers `POST /api/github-prs/sync` with `fullSync: true` and shows progress
- No TypeScript errors, no console errors in browser
- Pages are accessible without breaking the existing project detail nav

---

## Phase D — Docs + Scripts (IN PROGRESS — this task)

**Files being created in this phase:**

| File | Status |
|------|--------|
| `docs/product/PRD.md` | Being written now |
| `docs/product/TRD.md` | Being written now |
| `docs/product/ROADMAP.md` | Being written now |
| `docs/product/CURRENT_STATE.md` | Being written now |
| `docs/product/NEXT_2_DAYS_EXECUTION_PLAN.md` | This file |
| `docs/runbooks/dev-release.md` | Being written now |
| `scripts/dev/backup-db.sh` | Being written now |
| `scripts/dev/deploy-dev.sh` | Being written now |
| `scripts/dev/smoke-dev.sh` | Being written now |

**Decided autonomously:**
- All docs content based on actual source inspection
- Script logic (backup strategy, deploy steps, smoke test endpoints)
- No Rahul approval needed for docs/scripts — these are operational tooling

---

## Phase E — Quality Gates

**Day 2 morning, before opening PR:**

- [ ] Run `npm run build` — must be clean
- [ ] Run `npm run typecheck` (or `tsc --noEmit`) — must be clean
- [ ] Run test suite — all tests must pass
- [ ] Manual smoke test using `scripts/dev/smoke-dev.sh`:
  - `/api/health` returns `{"status":"ok"}`
  - `/api/github-prs` returns 401 when unauthenticated (acceptable)
- [ ] Visual check: load Intelligence page and Timeline page in browser
- [ ] Verify no `console.error` in browser dev tools on page load
- [ ] Verify `FullSyncButton` renders and is clickable (don't need to trigger real sync)

**Decisions that require Rahul approval before merging:**
- Any new Prisma migration — Rahul must review schema diff before `migrate deploy` on DEV
- Any change to auth middleware or RBAC logic
- Any change to the `approvalGuard` or `decisionEngine`
- Enabling any feature flag that was previously `false` (e.g., `FEATURE_SANDBOX_MODE=true` on DEV)

**Decisions that were made autonomously (no approval needed):**
- All new UI pages (intelligence, timeline)
- New read-only API routes (GET only, no mutations)
- Documentation and scripts
- Adding `FullSyncButton` to existing project pages
- `buildTimeline.ts` logic changes (pure function, fully tested)

---

## Phase F — PR

**Day 2 afternoon:**

- [ ] Squash or clean commits on feature branch
- [ ] Write PR description with:
  - What was built (intelligence page, timeline page, docs, scripts)
  - Screenshot or description of UI changes
  - Migration notes (list any new migrations)
  - Testing instructions
  - Feature flags used
- [ ] Request Rahul review
- [ ] Do not merge until Rahul approves

**PR checklist (do not open PR until all are green):**

- [ ] Build clean
- [ ] Typecheck clean
- [ ] All tests pass
- [ ] Smoke test passes on DEV
- [ ] No new secrets in diff
- [ ] `docs/product/` files committed
- [ ] `scripts/dev/` files committed and executable
- [ ] `docs/runbooks/dev-release.md` committed

---

## Timeline

| Time | Phase | Action |
|------|-------|--------|
| Day 1 AM | A + B | Discovery complete, backend confirmed done |
| Day 1 PM | C | Build intelligence UI page |
| Day 1 PM | D | Write docs and scripts (this task) |
| Day 2 AM | C | Complete timeline UI page, wire FullSyncButton |
| Day 2 AM | E | Quality gates: build, typecheck, tests, smoke |
| Day 2 PM | F | Open PR #175, request Rahul review |

---

## What Needs Rahul's Input

| Decision | Why Rahul | Urgency |
|----------|-----------|---------|
| Approve PR #175 for merge to main | Code review + final sign-off | End of Day 2 |
| Confirm DEV deploy after merge | Only Rahul has DEV server access | Day 2 post-merge |
| Decision on enabling `FEATURE_SANDBOX_MODE` on DEV | Feature flag change | Low — can wait |
| Prioritization of Phase 3 remaining items (auto-link, webhooks) | Product decision | Next sprint |
