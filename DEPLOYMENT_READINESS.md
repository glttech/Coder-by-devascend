# Phase 2 Deployment Readiness — Coder by DevAscend

## Quality Gate Summary

| Gate | Status |
|------|--------|
| Tests | 781 / 781 passing |
| TypeScript typecheck | 0 errors |
| ESLint | 0 warnings / 0 errors |
| Next.js production build | success |

Run date: 2026-06-17

---

## Phase 2 PR Summary

| PR | Title | Status |
|----|-------|--------|
| 2.2 | Trace Viewer UI — findings, evidence gaps, governance summary | Complete |
| 2.3 | Senior Approval Gate UI — red banner, approval routing | Complete |
| 2.1 | Real LLM integration behind `FEATURE_AGENT_LLM` flag | Complete |
| 2.4 | RAG Foundation — `EvidenceChunk` model, stub embedding provider | Complete |
| 2.5 | Unauthorized Agent Action Guard — cross-task/cross-PR protection | Complete |
| 2.6 | Final regression & deployment readiness | Complete |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FEATURE_AGENT_LLM` | `false` | Enable real Anthropic API calls for governance roles |
| `ANTHROPIC_API_KEY` | — | Required when `FEATURE_AGENT_LLM=true`; must not be set otherwise |
| `FEATURE_RAG_EMBED` | `false` | Enable real embedding API calls for evidence retrieval |
| `OPENAI_API_KEY` | — | Required when `FEATURE_RAG_EMBED=true`; must not be set otherwise |

**Safe to deploy without any of the above.** All LLM and embedding paths are gated and fail-closed.

---

## Safety Invariants (verified in tests)

1. `FEATURE_AGENT_LLM=false` (default) → all governance returns deterministic stubs, no API calls.
2. `FEATURE_AGENT_LLM=true` + missing `ANTHROPIC_API_KEY` → throws at call time (fail-closed).
3. `FEATURE_RAG_EMBED=false` (default) → stub embeddings, no external calls.
4. `FEATURE_RAG_EMBED=true` + missing `OPENAI_API_KEY` → throws at call time (fail-closed).
5. `decisionSuggestion='APPROVED'` from LLM → rejected by parser, error thrown.
6. `requiresApproval=true` in LLM output → stored as recommendation only; does NOT set `Approval.approved`.
7. Agent attempting to approve a task → `guardNoApprovalByAgent` blocks it.
8. Agent attempting to write to an unowned GitHub PR → `guardPrAction` blocks it.
9. Agent attempting cross-task writes → `guardTaskScope` blocks it.

---

## Database Migration Note

PR 2.4 adds the `EvidenceChunk` model. The Prisma schema is additive-only — no existing tables are altered.

Before deploying, run:
```bash
npx prisma migrate deploy
```

The migration adds one new table. No existing data is at risk. Rollback: drop the `EvidenceChunk` table.

---

## Deployment Checklist

- [ ] `DATABASE_URL` points to the target database
- [ ] `SESSION_SECRET` is set (minimum 32 chars)
- [ ] `ANTHROPIC_API_KEY` is set only if intentionally enabling LLM mode
- [ ] `FEATURE_AGENT_LLM` defaults to `false` in the deployment environment
- [ ] `FEATURE_RAG_EMBED` defaults to `false` in the deployment environment
- [ ] Prisma migration run: `npx prisma migrate deploy`
- [ ] All tests pass: `npm test`
- [ ] Production build succeeds: `npm run build`
- [ ] Monitoring and alerting in place for new `/api/tasks/*/orchestrate` route
- [ ] Human approval gate confirmed active for high-risk tasks
