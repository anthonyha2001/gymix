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

# 2. Point the web app at it — copy the "API URL", "anon key" and "service_role key"
#    printed by step 1 (or `npx supabase status -o env`)
cp web/.env.example web/.env.local   # then fill in the three values

# 3. Run the app
cd web && npm install && npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` stays on the server: it lets member invite links sign people in
without a password, and lets members log in with their phone or member code. Never expose it to the browser.

Open http://localhost:3000 (if that port is busy: `npm run dev -- --port 3100`). Local Supabase doesn't send real emails; any it would send show up in Mailpit (URL printed by `supabase start`).

After changing a migration: `npx supabase db reset` (wipes local data and re-applies everything), then
`npx supabase gen types typescript --local > web/src/lib/supabase/database.types.ts`.

## Super admin (platform console)

Super admins run Gymix itself: they log in to `/admin` and see every gym's numbers (not members' personal data).
The easiest way to make one: list the email in `SUPER_ADMIN_EMAILS` (comma-separated) in the app's environment.
That account becomes a super admin on its next login and lands on `/admin`. Or create or update one with the Supabase service role key (`npx supabase status` shows it locally); the password is
passed in the environment so it never ends up in the repo:

```sh
cd web
SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD='...' node scripts/create-super-admin.mjs you@example.com "Your Name"
```

`npx supabase db reset` wipes accounts, so rerun this after a reset.

## Control center (`/admin`)

The super admin console has six tabs, each with a 7/30/90-day range:

- **Overview**: monthly recurring revenue, paying/trial gyms, traffic, logins, sign-ups and errors compared with the
  previous period, plus gyms that need attention and the latest errors.
- **Traffic**: visitors, page views, top pages, referrers, countries, devices, browsers, busiest routes and a live request log.
- **Logins**: successful and failed logins with IP and country, login methods, and a warning when one IP fails 5+ times in a day.
- **Errors**: server errors (from `web/src/instrumentation.ts`) and browser errors (from `instrumentation-client.ts`
  and the error pages), grouped by message, with stack traces.
- **Gyms**: every gym with record payment, extend trial and suspend/reopen.
- **Revenue & pricing**: change the price, trial length and grace period; payment instructions; payment history;
  cleanup of old monitoring data.

Monitoring rows live in `platform_events`, written by the web app with the service role key and readable only by
super admins. Query strings are never stored, invite and check-in tokens are replaced with `:token`, and IP addresses
are kept only for login and sign-up events. Visitors are counted with an anonymous `gx_vid` cookie. Set
`GYMIX_TELEMETRY=off` to stop recording.

## Selling Gymix (subscriptions)

Each gym pays $10 a month after a 14-day free trial by default; a super admin changes the price, trial and grace
period in `/admin` (Revenue & pricing), stored in `platform_settings`. There is no card processor:
gyms pay by Whish, OMT or bank transfer and a super admin records it in `/admin` ("Record payment"), which
extends the gym's paid-until date. Also in `/admin`: extend a trial, and the payment instructions and WhatsApp
number every owner sees on Settings, Subscription. A few days (the grace period, 3 by default) after a subscription ends the staff dashboard locks
(the owner can still open the Subscription tab); members keep using their app.

## How access works

Every user has a role per gym: `owner`, `manager`, `front_desk`, `trainer`, `dietitian` or `member`.
Staff land on `/dashboard`, members on `/portal`, users with no gym on `/onboarding` (create a gym → become its owner).

- Staff invite people by email on **Team & members**. The invite is claimed automatically when that email signs up or logs in.
- Who can invite/assign which role: owner → anyone but owner; manager → front desk, trainer, dietitian, member; front desk → member.
- Members are invited with a personal link (WhatsApp or copy). Opening it signs them straight in; Gymix generates a
  password shown once, for logging in elsewhere with their phone, email or member code. The front desk can reset it.
- The owner chooses which member-app pages are visible (Settings → Member app).
- A member still owing money a set number of days after an invoice (Settings → Gym, default 3) is frozen: the
  member app shows only its home page and check-in is refused. Their next check-in after paying unfreezes it.
- All of this is enforced in the database with row-level security (`supabase/migrations/*_foundation.sql`), not only in the UI.

## Tests

`bash supabase/tests/run_tests.sh` applies every migration to a throwaway Postgres container and checks
what each role can and can't do (needs Docker; on Git Bash prefix with `MSYS_NO_PATHCONV=1`).
