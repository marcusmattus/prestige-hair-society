#!/usr/bin/env bash
# Rebuild the local test database from scratch and apply every migration.
#
# This is for local verification against a plain PostgreSQL 16 instance. It
# applies supabase/local/00_shim.sql first to stand in for the Supabase auth
# schema, then every file in supabase/migrations in order.
#
# Usage: ./scripts/db-reset.sh [dbname]
set -euo pipefail

DB="${1:-prestige_test}"
PSQL_BASE=(psql -v ON_ERROR_STOP=1 --quiet)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PGUSER="${PGUSER:-postgres}"
export PGHOST="${PGHOST:-/var/run/postgresql}"

echo "Rebuilding database '$DB'..."
psql -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE);" >/dev/null
psql -d postgres -c "CREATE DATABASE $DB;" >/dev/null

"${PSQL_BASE[@]}" -d "$DB" -f "$ROOT/supabase/local/00_shim.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "  applying $(basename "$migration")"
  "${PSQL_BASE[@]}" -d "$DB" -f "$migration"
done

echo "Done. Connect with: psql -d $DB"
