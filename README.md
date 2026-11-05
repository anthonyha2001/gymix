# Gymix

The operating system for gyms: an owner/staff dashboard plus a member portal.

- `web/` — Next.js 16 (App Router, TypeScript, Tailwind v4). Read `web/AGENTS.md` before writing Next-specific code.
- `supabase/` — Postgres schema as migrations, plus local dev config.

## Features

**Staff dashboard**

- Members, memberships (monthly, yearly, visit packs), invoices and payments in USD and lira; freeze, resume, renew.
- Schedule with a day/week/month calendar (a list on phones) and quick add; trainers see only their own classes.
- Classes, bookings and waitlists, personal training, monthly courses, nutrition plans.
- Equipment: the owner lists the gym's machines, and programs only use exercises for that equipment.
- Machines with NFC and QR stickers (generated in the dashboard) that open a how-to sheet in the member app.
- Chat with members, including the automatic WhatsApp messages each member was sent, with time and delivery status.
- Automatic WhatsApp (see below): renewal reminders N days before expiry (Settings), payment receipts, new-member logins.

**Member app** (a PWA for iPhone and Android: Home, Train, Schedule, Progress, More)

- Home: today's workout, weekly goal and streak, membership, next class, invoices.
- Programs: build their own or ask a trainer; edit (pen) or delete (trash, with a confirmation).
- Training days: pick weekdays and which program day each one is for; reminders on those days.
- Workout logger with rest timer, a Finish bar always on screen, personal-record alerts.
- Shake the phone (three times, quickly) to open the Programs page behind a lime wave. One motion detector
  (`components/motion-gestures.tsx`) tells a shake from a drop, so only one of them fires. iPhones ask for motion access on the first tap.
- Dropped phone: free fall followed by a hard hit plays a cracked-screen joke animation (Profile, "Try it").
- Pause and resume their own membership (the paused days are added to the end date).
- No active membership, paused, or frozen for an unpaid balance: only Home is open and its training parts are greyed out.
- Micro-animations throughout (staggered cards, press feedback, set check pop, confetti on records); all off when
  the phone asks for reduced motion.

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
- **Gyms**: every gym with record payment, extend trial and suspend/reopen, plus:
  - **Open dashboard** (support access): enter that gym's dashboard as its owner without an account there. A banner
    shows it; "Back to admin" leaves. Stored in `platform_admin_visits` (one gym at a time) and honoured by
    `my_gym_role()`, so every database permission check applies as for the owner.
  - **Send a notification** to every gym's team, or everyone including members (lands in their bell).
  - **WhatsApp (Gymix number)**: the Meta phone number ID and access token, kept in `platform_secrets`
    (server-only, no policies).
- **Revenue & pricing**: change the price, trial length and grace period; payment instructions; payment history;
  cleanup of old monitoring data.

Monitoring rows live in `platform_events`, written by the web app with the service role key and readable only by
super admins. Query strings are never stored, invite and check-in tokens are replaced with `:token`, and IP addresses
are kept only for login and sign-up events. Visitors are counted with an anonymous `gx_vid` cookie. Set
`GYMIX_TELEMETRY=off` to stop recording.

## Selling Gymix (subscriptions)

Each gym pays $19.99 a month after a 14-day free trial by default; a super admin changes the price, trial and grace
period in `/admin` (Revenue & pricing), stored in `platform_settings`. There is no card processor:
gyms pay by Whish, OMT or bank transfer and a super admin records it in `/admin` ("Record payment"), which
extends the gym's paid-until date. Also in `/admin`: extend a trial, and the payment instructions and WhatsApp
number every owner sees on Settings, Subscription. A few days (the grace period, 3 by default) after a subscription ends the staff dashboard locks
(the owner can still open the Subscription tab); members keep using their app.

## Lab & features (`/admin`, Lab & features tab)

- **Lab gym**: "Create my lab gym" makes a gym only the super admin uses (`gyms.is_lab`, never billed). Open it as
  any role (owner, manager, front desk, trainer, dietitian, member). As a member you get a lab member record with a
  year-long membership, and land in the member app.
- **Open any gym as a role**: any staff role in a real gym (support access; changes are real). The role lives in
  `platform_admin_visits.role` and is what `my_gym_role()` returns, so the database enforces exactly that role.
- **Feature switches** (`features`): each is Off, Lab only or Everyone, plus per-gym exceptions
  (`gym_feature_overrides`). The app asks `hasFeature(gymId, key)` (`web/src/lib/features.ts`).
- **Shipping a new feature**: add its key to `features` in a migration with rollout `lab`, wrap the code in
  `hasFeature`, try it in the lab, then switch it to Everyone. Current keys: `whatsapp`, `shake_to_open`,
  `drop_animation`, `self_pause`.

## Automatic WhatsApp

Sent from one Gymix number through Meta's WhatsApp Cloud API (`web/src/lib/whatsapp.ts`), at most once each
(`whatsapp_log`, unique on kind + ref):

- **Renewal reminder**: a daily Vercel cron (`/api/cron/whatsapp`, 07:00 UTC, protected by `CRON_SECRET`) messages
  members whose membership ends in the gym's "renewal reminder" days (Settings, default 3, 0 = off).
- **Payment receipt**: when staff sell a membership with a payment or record a payment.
- **Welcome**: a new member added with a phone gets their one-tap portal login link.

Setup: create these Utility templates (English) in WhatsApp Manager, then save the keys in `/admin` (Gyms) or set
`WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Without keys nothing is sent.

- `gymix_renewal_reminder`: Hi {{1}}, your {{2}} membership ends on {{3}}. Renew at the front desk to keep training.
- `gymix_payment_received`: Hi {{1}}, {{2}} received your payment of {{3}}. Thank you!
- `gymix_member_welcome`: Hi {{1}}, {{2}} has set up your Gymix account. Open your portal: {{3}}

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
- The same Home-only lock applies with no active membership (none, expired, paused, not started, visits used up).
  Members pause and resume their own membership from Home (`freeze_my_membership`).
- All of this is enforced in the database with row-level security (`supabase/migrations/*_foundation.sql`), not only in the UI.

## Tests

`bash supabase/tests/run_tests.sh` applies every migration to a throwaway Postgres container and checks
what each role can and can't do (needs Docker; on Git Bash prefix with `MSYS_NO_PATHCONV=1`).
