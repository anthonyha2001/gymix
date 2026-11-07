#!/usr/bin/env bash
# Runs every tests/*_test.sql against its own fresh database (auth stub + all
# migrations) in a throwaway Postgres container.
# Usage (from repo root): bash supabase/tests/run_tests.sh [name]  (e.g. "access" runs access_test.sql only)
set -euo pipefail

cd "$(dirname "$0")/.."
NAME=gymix-schema-test

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1

run() { docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"; }

# Roles are cluster-wide, so create them once.
run -c "create role anon; create role authenticated; create role service_role bypassrls;"

for t in tests/${1:-*}_test.sql; do
  echo "running $t"
  run -c "drop database if exists t;" -c "create database t;"
  grep -v -E '^create role ' tests/auth_stub.sql | run -d t
  for f in migrations/*.sql; do
    run -d t < "$f"
  done
  run -d t < "$t"
done
