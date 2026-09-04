#!/usr/bin/env bash
# Rebuild the local database, seed it, and run the SQL constraint and RLS
# suites. A clean exit means every assertion in those files held.
set -euo pipefail

DB="${1:-prestige_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PGUSER="${PGUSER:-postgres}"
export PGHOST="${PGHOST:-/var/run/postgresql}"

"$ROOT/scripts/db-reset.sh" "$DB"

echo "Seeding..."
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/seed.sql"
# The SQL suites are written against the placeholder fixture catalogue, which
# has two stylists eligible for one service. The real catalogue has one stylist.
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/local/01_test_fixtures.sql"

echo
echo "=== Constraint tests ==="
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/local/02_constraint_tests.sql"

echo
echo "=== RLS tests ==="
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/local/03_rls_tests.sql"
