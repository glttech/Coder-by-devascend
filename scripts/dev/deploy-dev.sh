#!/usr/bin/env bash
# deploy-dev.sh — Apply latest changes to the DEV environment.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/dev/deploy-dev.sh
#
# Steps:
#   1. Check git status (warn if dirty)
#   2. git pull --ff-only origin main
#   3. npm ci
#   4. npx prisma generate
#   5. Database backup via backup-db.sh
#   6. npx prisma migrate deploy
#   7. npm run build
#   8. Print restart instructions
#
# This script does NOT auto-restart the dev server. Restart manually.
# This script NEVER touches production. It is DEV-only.
# This script NEVER prints DATABASE_URL or any credentials.
#
# Prerequisites:
#   - DATABASE_URL must be set in environment
#   - Node.js and npm must be installed
#   - pg_dump must be installed (required by backup-db.sh)
#   - Run from the repository root: ./scripts/dev/deploy-dev.sh
#   - chmod +x scripts/dev/deploy-dev.sh scripts/dev/backup-db.sh

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "======================================================"
echo "  Coder by DevAscend — DEV Deploy"
echo "  $(date)"
echo "======================================================"
echo ""

# ── Step 1: Check git status ─────────────────────────────────────────────────

echo "[Step 1/7] Checking git status..."
cd "${REPO_ROOT}"

DIRTY="$(git status --porcelain 2>/dev/null || true)"
if [[ -n "${DIRTY}" ]]; then
  echo "WARNING: Working tree has uncommitted changes:"
  git status --short
  echo ""
  echo "Proceeding with deploy — but uncommitted changes will NOT be deployed."
  echo "If this is unexpected, abort now with Ctrl+C (waiting 5 seconds)."
  sleep 5
else
  echo "  Working tree is clean."
fi
echo ""

# ── Step 2: Pull latest from main ────────────────────────────────────────────

echo "[Step 2/7] Pulling latest from origin main..."
git pull --ff-only origin main
echo ""

# ── Step 3: Install dependencies ─────────────────────────────────────────────

echo "[Step 3/7] Installing dependencies (npm ci)..."
npm ci
echo ""

# ── Step 4: Generate Prisma client ───────────────────────────────────────────

echo "[Step 4/7] Generating Prisma client..."
npx prisma generate
echo ""

# ── Step 5: Database backup ───────────────────────────────────────────────────

echo "[Step 5/7] Backing up database before migration..."
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Cannot backup or migrate." >&2
  exit 1
fi
bash "${SCRIPT_DIR}/backup-db.sh"
echo ""

# ── Step 6: Run migrations ────────────────────────────────────────────────────

echo "[Step 6/7] Running database migrations (prisma migrate deploy)..."
echo "  This applies any pending migrations. Review the migration list in"
echo "  prisma/migrations/ before running if you have any doubts."
npx prisma migrate deploy
echo ""

# ── Step 7: Build application ─────────────────────────────────────────────────

echo "[Step 7/7] Building application (npm run build)..."
npm run build
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────

echo "======================================================"
echo "  Deploy steps complete."
echo ""
echo "  ACTION REQUIRED: Restart your dev server manually."
echo "  The deploy script does not manage processes."
echo ""
echo "  To restart a Next.js dev server:"
echo "    Ctrl+C the running process, then: npm run dev"
echo ""
echo "  To restart a production build:"
echo "    Kill the existing 'node server.js' / 'next start' process,"
echo "    then re-launch it with your usual start command."
echo ""
echo "  After restart, run the smoke test:"
echo "    ./scripts/dev/smoke-dev.sh"
echo "======================================================"
