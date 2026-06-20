# DEV Release Runbook — Coder by DevAscend

**Environment:** DEV (local or self-hosted dev server)  
**Scope:** Merge a PR to main and deploy to DEV. Does not touch PROD.  
**Maintained by:** Rahul (sole operator)

---

## Prerequisites

Before starting a release:

1. **Backup is available** — confirm the last backup in `~/coder-backups/` is recent. If not, run one now:
   ```bash
   ./scripts/dev/backup-db.sh
   ```

2. **Git state is known** — know which PR you are merging. Have the PR number and branch name ready.

3. **No pending migration conflicts** — check `prisma/migrations/` on the feature branch vs. `main`. Each migration folder name must be unique. If two branches added a migration on the same date with the same prefix, resolve the conflict before merging.

4. **Test suite is green** — the PR's CI checks must pass before merge. Do not merge a red PR.

5. **Build is clean** — verify locally on the branch:
   ```bash
   npm run build
   npx tsc --noEmit
   ```

---

## Step 1 — Backup Before Anything Else

Always take a fresh backup immediately before running migrations. Do not skip this.

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/coder"
./scripts/dev/backup-db.sh
```

Note the backup file path printed on success. Keep it until you confirm the app is healthy post-deploy.

---

## Step 2 — Merge the PR

Merge the PR on GitHub (squash-merge or merge commit — Rahul's preference). Do not merge via `git push` directly.

After merge, confirm the PR is closed on GitHub before proceeding.

---

## Step 3 — Pull main on DEV

On the DEV server:

```bash
cd /path/to/coder-by-devascend
git pull --ff-only origin main
```

If this fails with "not a fast-forward", it means local main has diverged. Investigate before proceeding:

```bash
git log --oneline origin/main..HEAD
```

If there are local commits not on main, this is unexpected. Do not force-reset. Investigate.

---

## Step 4 — Install Dependencies

```bash
npm ci
```

`npm ci` installs from `package-lock.json` exactly. Do not use `npm install` in a deploy context — it can silently update the lockfile.

---

## Step 5 — Generate Prisma Client

```bash
npx prisma generate
```

This regenerates the TypeScript client from `prisma/schema.prisma`. Always run this after pulling a branch that modifies the schema, even if no migration was added.

---

## Step 6 — Review and Run Migrations

Before running migrations, check which migrations are pending:

```bash
npx prisma migrate status
```

Expected pending migrations vary by PR. As of 2026-06-18, these are the confirmed applied migrations:

- `20260521140745_init`
- `20260525120000_add_operator_session`
- `20260525130000_add_instruction`
- `20260525140000_instruction_transition_fields`
- `20260525150000_instruction_state_version`
- `20260603000001_add_project_github_fields_and_github_pr`
- `20260612000000_add_user_role`
- `20260612171446_add_active_session`
- `20260612183020_add_orchestration_models`
- `20260612190000_add_notification`
- `20260614000000_add_project_tracker_fields`
- `20260616000003_add_diagram`
- `20260616000004_add_api_key`
- `20260616000005_add_invitation`
- `20260616000006_add_comment`
- `20260616000007_add_notification_preference`
- `20260616000008_add_ci_run`
- `20260616000009_add_share_link`
- `20260616000010_add_webhook`
- `20260616000011_add_user_credentials`
- `20260616000012_add_organization`
- `20260617000001_add_agent_role`
- `20260617000002_add_execution_trace`
- `20260617000003_pr_memory_index`

Any migration name in `prisma/migrations/` that does not appear in this list is a new migration introduced by the PR you just merged.

**Review each new migration file** before running. Look for:
- `DROP TABLE` — should never happen in a routine feature PR
- `DROP COLUMN` — review carefully; may lose data
- `NOT NULL` additions without a `DEFAULT` — will fail if existing rows have null values

Once reviewed:

```bash
npx prisma migrate deploy
```

`migrate deploy` applies pending migrations only. It does not auto-generate new migrations. It will fail fast if a migration fails — do not retry blindly.

---

## Step 7 — Rebuild

```bash
npm run build
```

The build must succeed before restarting the server. If the build fails, do not restart. Investigate and fix before proceeding.

---

## Step 8 — Restart Dev Server

**This script does not auto-restart the server.** Restart manually:

For a Next.js dev server:
```bash
# Ctrl+C to stop the running process, then:
npm run dev
```

For a production build (next start):
```bash
# Kill the existing process (pkill -f "next start" or use your process manager)
npm run start
```

After restart, wait for the server to be ready (look for the "Ready" message in the log).

---

## Step 9 — Smoke Test

Run the automated smoke test:

```bash
APP_URL=http://localhost:3000 ./scripts/dev/smoke-dev.sh
```

Expected output:
```
[PASS] GET /api/health → 200 with {"status":"ok"}
[PASS] GET /api/github-prs → 401 Unauthorized (auth guard working)
[PASS] Database connectivity — prisma db pull completed without errors
All checks passed. DEV environment looks healthy.
```

If any check fails, see the Rollback Procedure below.

**Manual smoke test checklist** (run in browser after automated check passes):

- [ ] Dashboard (`/`) loads without error
- [ ] Task list (`/tasks`) loads without error
- [ ] Create a test task (do not submit — just verify the form renders)
- [ ] Project list (`/projects`) loads without error
- [ ] Audit log (`/audit`) loads without error
- [ ] If PRs are imported: project PRs tab loads without error
- [ ] If the PR introduced a new page (e.g., Intelligence, Timeline): navigate to it and confirm it loads

---

## Rollback Procedure

If anything fails after migration, restore from the backup taken in Step 1.

### Option A — Restore database from backup

```bash
# Stop the application first (Ctrl+C the dev server)

# Restore using pg_restore (replace placeholders):
pg_restore \
  --dbname="postgresql://user:pass@localhost:5432/coder" \
  --clean \
  --if-exists \
  ~/coder-backups/<backup_file>.dump

# After restore, go back to the previous git state:
git checkout main
git reset --hard <previous_commit_sha>

# Reinstall and regenerate:
npm ci
npx prisma generate

# Restart server
npm run dev
```

### Option B — Revert the PR commit (if migration has not yet run)

If you are in Step 3–4 (before migration), you can simply:

```bash
git reset --hard HEAD~1  # undo the git pull
```

Then investigate and fix the issue before re-deploying.

### After rollback

- Document what failed and why in `docs/AGENT_EXECUTION_LOG.md`
- Do not re-deploy until the root cause is understood
- Re-take a backup after restoring to confirm the restored DB is healthy

---

## PROD Gate

**PROD deployment is NOT part of this runbook.**

PROD deployments require:
1. DEV smoke test green
2. Rahul's explicit approval (separate sign-off, not just PR merge)
3. Scheduled maintenance window (no silent production pushes)
4. A dedicated PROD runbook (not yet written)

Do not attempt to deploy to PROD using this runbook or these scripts. When in doubt, ask first.
