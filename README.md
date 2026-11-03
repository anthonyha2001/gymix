# Gymix

The operating system for gyms: an owner/staff dashboard plus a member portal.

- `web/` — Next.js 16 (App Router, TypeScript, Tailwind v4). Read `web/AGENTS.md` before writing Next-specific code.
- `supabase/` — Postgres schema as migrations, plus local dev config.

## Running locally

Needs Node 22+ and Docker Desktop (running).

```sh
# 1. Start the local Supabase stack (Postgres, auth, API) and apply migrations.
#    The -x list skips optional services (dashboard UI, logs, realtime) to save ~2 GB.
npx supabase start -x studio,logflare,vector,realtime,imgproxy,postgres-meta,edge-runtime,supavisor

# 2. Point the web app at it — copy the "API URL" and "anon key" printed by step 1
cp web/.env.example web/.env.local   # then fill in the two values

# 3. Run the app
cd web && npm install && npm run dev
```

Open http://localhost:3000 (if that port is busy: `npm run dev -- --port 3100`). Local Supabase doesn't send real emails; any it would send show up in Mailpit (URL printed by `supabase start`).

After changing a migration: `npx supabase db reset` (wipes local data and re-applies everything), then
`npx supabase gen types typescript --local > web/src/lib/supabase/database.types.ts`.

## How access works

Every user has a role per gym: `owner`, `manager`, `front_desk`, `trainer` or `member`.
Staff land on `/dashboard`, members on `/portal`, users with no gym on `/onboarding` (create a gym → become its owner).

- Staff invite people by email on **Team & members**. The invite is claimed automatically when that email signs up or logs in.
- Who can invite/assign which role: owner → anyone but owner; manager → front desk, trainer, member; front desk → member.
- All of this is enforced in the database with row-level security (`supabase/migrations/*_foundation.sql`), not only in the UI.

## Tests

`bash supabase/tests/run_tests.sh` applies every migration to a throwaway Postgres container and checks
what each role can and can't do (needs Docker; on Git Bash prefix with `MSYS_NO_PATHCONV=1`).
