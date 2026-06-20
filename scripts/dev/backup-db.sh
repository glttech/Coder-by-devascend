#!/usr/bin/env bash
# backup-db.sh — Create a compressed pg_dump backup of the Coder database.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./scripts/dev/backup-db.sh
#
# The backup is written to ~/coder-backups/<dbname>_<timestamp>.dump
# using pg_dump custom format (-Fc), which supports parallel restore.
#
# Prerequisites:
#   - pg_dump must be installed and on PATH
#   - DATABASE_URL must be set in the environment
#   - chmod +x scripts/dev/backup-db.sh
#
# This script never prints DATABASE_URL or any credentials.

set -Eeuo pipefail

# ── Validate prerequisites ──────────────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export it before running this script." >&2
  echo "  Example: export DATABASE_URL=\"postgresql://user:pass@localhost:5432/coder\"" >&2
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  echo "ERROR: pg_dump not found on PATH. Install postgresql-client." >&2
  exit 1
fi

# ── Extract database name from URL ──────────────────────────────────────────
# DATABASE_URL format: postgresql://user:pass@host:port/dbname[?params]
# Strip everything before the last '/' and any trailing query string.

DB_NAME="$(echo "${DATABASE_URL}" | sed 's|.*\/||' | sed 's|?.*||')"

if [[ -z "${DB_NAME}" ]]; then
  echo "ERROR: Could not extract database name from DATABASE_URL." >&2
  echo "  Expected format: postgresql://user:pass@host:5432/dbname" >&2
  exit 1
fi

# ── Prepare backup directory ─────────────────────────────────────────────────

BACKUP_DIR="${HOME}/coder-backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

# ── Run backup ───────────────────────────────────────────────────────────────

echo "Starting backup of database: ${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"

pg_dump "${DATABASE_URL}" -Fc -f "${BACKUP_FILE}"

# ── Verify backup file ───────────────────────────────────────────────────────

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: Backup file was not created: ${BACKUP_FILE}" >&2
  exit 1
fi

BACKUP_SIZE="$(wc -c < "${BACKUP_FILE}")"

if [[ "${BACKUP_SIZE}" -eq 0 ]]; then
  echo "ERROR: Backup file is empty (0 bytes). The backup likely failed." >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

echo "Backup complete."
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE} bytes"
