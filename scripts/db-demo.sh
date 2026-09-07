#!/usr/bin/env bash
# Rebuild the local database with the catalogue seed and fictional demo data,
# ready for development or an end-to-end run.
set -euo pipefail

DB="${1:-prestige_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGUSER="${PGUSER:-postgres}"
export PGHOST="${PGHOST:-/var/run/postgresql}"

"$ROOT/scripts/db-reset.sh" "$DB"
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/seed.sql"
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/catalogue.sql"
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/photos.sql"
psql -v ON_ERROR_STOP=1 --quiet -d "$DB" -f "$ROOT/supabase/local/04_demo_data.sql"

echo
echo "Ready. Sign-ins (set passwords via Supabase Auth, or use magic links):"
echo "  owner@example.test    admin + manager"
echo "  desk@example.test     receptionist"
echo "  stylist@example.test  stylist (Nekeia Griffith)"
echo "  ada@example.test      customer with history"
