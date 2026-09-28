#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql not found. Install postgresql-client (brew install libpq / apt install postgresql-client)." >&2
  exit 1
fi

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "Error: TARGET_DB_URL is not set (the database to restore INTO)." >&2
  exit 1
fi

BACKUP_DIR="backups"
TIMESTAMP="${1:-}"

if [[ -z "$TIMESTAMP" ]]; then
  TIMESTAMP="$(ls -1 "$BACKUP_DIR"/backup_*_schema.sql 2>/dev/null | sort | tail -n1 | sed -E 's#.*backup_([0-9]{8}_[0-9]{6})_schema\.sql#\1#')"
fi

if [[ -z "$TIMESTAMP" ]]; then
  echo "Error: no backup found in $BACKUP_DIR." >&2
  exit 1
fi

ROLES_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_roles.sql"
SCHEMA_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_schema.sql"
DATA_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_data.sql"

for f in "$ROLES_FILE" "$SCHEMA_FILE" "$DATA_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: missing $f" >&2
    exit 1
  fi
done

if [[ "${FORCE:-0}" != "1" ]]; then
  echo "Restoring backup $TIMESTAMP into TARGET_DB_URL."
  echo "This can overwrite existing objects and data."
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring roles from $ROLES_FILE..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$ROLES_FILE"

echo "Restoring schema from $SCHEMA_FILE..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

echo "Restoring data from $DATA_FILE..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DATA_FILE"

echo "Restore complete."
