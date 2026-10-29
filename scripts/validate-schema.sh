#!/bin/bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
db="hrms_schema_check"

dropdb --if-exists "$db"
createdb "$db"

psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/scripts/schema-harness.sql" >/dev/null

for file in "$root"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$file")"
  psql -v ON_ERROR_STOP=1 -d "$db" -f "$file"
done

echo "Running security and payroll checks"
psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/scripts/validate-schema.sql"

dropdb "$db"
echo "Schema validation passed"
