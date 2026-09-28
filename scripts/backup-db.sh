#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL is not set." >&2
  exit 1
fi

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ROLES_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_roles.sql"
SCHEMA_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_schema.sql"
DATA_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_data.sql"

echo "Dumping roles to $ROLES_FILE..."
supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$ROLES_FILE"

echo "Dumping schema to $SCHEMA_FILE..."
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$SCHEMA_FILE"

echo "Dumping data to $DATA_FILE..."
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$DATA_FILE"

echo "Backup complete:"
ls -1 "$ROLES_FILE" "$SCHEMA_FILE" "$DATA_FILE"
