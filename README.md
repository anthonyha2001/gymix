# Gymix

The operating system for gyms: an owner/staff dashboard plus a member portal.

- `web/` — Next.js 16 (App Router, TypeScript, Tailwind v4). Read `web/AGENTS.md` before writing Next-specific code.
- `supabase/` — Postgres schema as migrations, plus local dev config.

## Features

**Staff dashboard**

- Members, memberships (monthly, yearly, visit packs), invoices and payments in USD and lira; freeze, resume, renew.
- Schedule with a day/week/month calendar (a list on phones) and quick add; trainers see only their own classes.
- Classes, bookings and waitlists, personal training, monthly courses.
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
  - **WhatsApp (Gymix number)**: the Meta phone number ID, WhatsApp Business account ID, access token and app
    secret, kept in `platform_secrets` (server-only, no policies); template status and the webhook details.
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
  any role (owner, manager, front desk, trainer, member). As a member you get a lab member record with a
  year-long membership, and land in the member app.
- **Open any gym as a role**: any staff role in a real gym (support access; changes are real). The role lives in
  `platform_admin_visits.role` and is what `my_gym_role()` returns, so the database enforces exactly that role.
- **Feature switches** (`features`): each is Off, Lab only or Everyone, plus per-gym exceptions
  (`gym_feature_overrides`). The app asks `hasFeature(gymId, key)` (`web/src/lib/features.ts`).
- **Shipping a new feature**: add its key to `features` in a migration with rollout `lab`, wrap the code in
  `hasFeature`, try it in the lab, then switch it to Everyone. Current keys: `whatsapp`, `shake_to_open`,
  `drop_animation`, `self_pause`, `access_control` (lab), `live_occupancy` (lab), `pos` (lab), `screens` (lab),
  `self_service` (lab).

## Live demo (`/demo`)

"Start the demo" gives each visitor a private sample gym in the real app, **Atlas Fitness**, signed in as its
owner: 25 members (active, ending soon, expired, paused, owing), payments, three weeks of check-ins, classes with
bookings, a program with logged workouts, measurements, a shop with sales, a chat and a TV screen.

- **Built by** `create_demo_gym()` (`supabase/migrations/20261110090000_demo_gyms.sql`), which runs the app's own
  functions as the owner, then dates the history back. Two sign-ins per gym (`@demo.gymix.invalid`), with passwords
  derived from the email and the service key (`web/src/lib/demo.ts`), so nothing is stored.
- **Guide** (`web/src/components/demo-guide.tsx`, stops in `web/src/lib/demo-guide.ts`): a card on every page saying
  what it's for and what to try with the sample data, and the next stop's links pulse. Only pages in the gym's menu
  are included, so lab features join the tour once they're switched on for everyone. The bar on top switches to the
  sample member's app (Karim) and back, starts a real trial, or exits.
- **Safe**: WhatsApp messages are logged as delivered but never sent; connecting a real WhatsApp number and changing
  the sample sign-ins' passwords are refused; sample gyms are left out of the admin gym list and lab.
- **Limits and cleanup**: 5 demos per visitor per hour and 400 a day (`demo_starts`). Each gym is deleted after
  24 hours (each new demo cleans up a few, plus the daily `/api/cron/demo`), or straight away on Exit or "Start my
  free trial".
- Tests: `supabase/tests/demo_test.sql`.

## Self-service reception

Dashboard → **Reception** (front desk and up, feature `self_service`). A kiosk link, `/kiosk/<token>`, opens on a
tablet at the entrance; it talks only to `/api/kiosk/<token>`, whose database functions check the kiosk is on, what
it allows, and refuse more than 40 requests a minute. People can **check in** (phone, member code, or the QR on
their Profile; source `kiosk`), **join** (a new member; an existing phone is reused) and **buy or renew**: the
kiosk creates a `payment_intents` row with a reference like `GX-4821` and shows how to pay (desk, card terminal,
Whish or OMT, as set under Ways to pay). When the payment is verified, `activate_payment_intent` sells the plan with
the payment, starting the day after the current membership ends for a renewal, and the kiosk shows it straight away.
Verified by the front desk (Waiting payments → Confirm paid), or by a payment provider through
`POST /api/payments/webhook` with `X-Gymix-Signature: hex(HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, body))` and
`{"gym_id", "reference", "amount_usd", "provider_ref", "method"}`; then the sale is made as the gym's owner. Without
`PAYMENT_WEBHOOK_SECRET` (32+ characters) the webhook is off. Tests: `supabase/tests/self_service_test.sql`.

## Gymix Screens

Dashboard → **Screens** (owners and managers, feature `screens`). Each screen has a secret link,
`/screen/<token>`, opened full screen on a smart TV browser, a TV stick or a tablet. The player
(`web/src/app/screen/[token]/player.tsx`) loops the slides, polls `/api/screens/<token>` every minute (that's
`screen_feed()`), keeps showing the last content when offline, keeps the display awake and reloads every six hours.
Slides: announcements and offers (headline, text, photo in `gym-media/<gym>/screens/`, dark/lime/light), today's
remaining classes with spots left, the month's check-in leaderboard, the week's personal records, and live occupancy.
Each slide can be limited to some screens, dates, weekdays and times of day. Members appear as "Nour K." and can
opt out on their Profile (`set_show_on_screens`). Tests: `supabase/tests/screens_test.sql`.

## Shop (POS)

Dashboard → **Shop** (feature `pos`). The front desk sells (Register, Sales); owners and managers also manage
Products, Stock and Reports. `pos_checkout` is one atomic sale: it locks the products, refuses to sell more than is
in stock (for products that count stock), records each line with its price and cost at that moment, and lowers
stock with a `stock_movements` row. Paid by cash (USD or lira at the gym's rate), card, Whish or OMT, or put **on a
member's account**, which creates a normal invoice ("Shop: …"), so it shows in Billing and counts towards the
unpaid-account freeze. Stock only changes through sales, refunds (`pos_refund`, which voids an account sale's invoice
while nothing is paid on it), deliveries (`pos_receive_stock`, optionally updating the cost) and counts
(`pos_count_stock`). `pos_report` gives revenue, cost, profit, best sellers, payment methods and revenue by day.
Barcode scanners work anywhere on the Register (they type the code and Enter); phones can scan with the camera where
the browser supports it. Tests: `supabase/tests/pos_test.sql`.

## Offline mode

Members keep using the app with weak or no signal (`web/public/sw.js`, `web/src/lib/outbox.ts`).

- **Pages**: `/portal` and `/dashboard` pages are live first; after 4 s without an answer (or offline) the copy
  saved on the phone shows, and the live page replaces it in the background. The member's main pages are saved in
  the background every 6 h (`warm`, with their scripts; marked `X-Gymix-Warm` so they aren't counted as visits).
  No saved copy: `/offline`. App files (`/_next/static`, icons) are kept on the phone.
- **Workouts offline**: logging or removing a set and finishing a workout go into an IndexedDB outbox (the same set
  logged twice keeps the latest), shown with a "waiting to sync" mark, and `<OutboxSync>` sends them to
  `/api/sync` when the phone is back online (oldest first, as the member; records found then are announced).
  Changes that can never save (workout deleted) are dropped and reported. Starting a workout needs a connection.
- **Privacy**: the login page tells the service worker to forget saved pages (`forget-pages`); queued changes stay
  and only sync for their own account (row-level security).

## Monthly challenges

Dashboard → **Challenges** (owners and managers, feature `challenges`, on for everyone) and the member app's
**Challenges** page (`supabase/migrations/*_challenges.sql`).

- The gym posts a challenge: what counts (`visits` days at the gym, `workouts` finished with logged sets,
  `volume` kg lifted, `classes` attended), dates (up to ~3 months; "rest of this month" / "next month" presets),
  an optional goal and prize. Every member with an account is notified (`challenges_announce` trigger).
- Members swipe new challenges as cards: right joins, left skips (buttons and arrow keys too); joining bursts
  confetti. Joined challenges show a filling progress ring, their rank and a leaderboard sheet; ended ones show medals.
- Scores are never typed in: `challenge_scores()` counts from check-ins, workouts, set logs and class bookings in
  the gym's timezone. `challenge_board()` ranks joined members; other members see first name and initial only.
- Tests: `supabase/tests/challenges_test.sql`.

## Gym location, maps and who is still inside

(`supabase/migrations/*_presence.sql`, `web/src/components/gym-map.tsx`)

- **Gym location**: owners set it in Settings → Gym → Location (address search via OpenStreetMap, "I'm at the gym",
  or tap/drag the pin); stored in `gyms.door_lat/door_lng/address` (`set_gym_location`). "Phone must be at the
  gym" (Access → Phone taps) is a switch on top of it (`door_radius_m` set = on).
- **Gymix map**: `/admin` → Map shows every gym with a location, named, coloured by subscription (lime paying, amber
  trial, red overdue/suspended), and lists gyms not on the map yet. Maps are Leaflet with OpenStreetMap tiles.
- **Exits**: every door sticker tap is now a door event (`method = 'phone'`): the exit sticker records an exit; a
  sticker on a two-way door is an exit for a member already inside 10+ minutes. Any exit ends the visit
  (`checkins.left_at`, `left_how`); coming back in reopens it (trigger `access_events_presence`).
- **Location checks**: in gyms with the switch on, the member app (while open, only if location was already allowed;
  never prompts) calls `presence_ping` every 10 minutes and on return to the app: at the gym → `seen_at` (keeps the
  visit counted past the usual length); clearly away (beyond twice the radius, ≥ 300 m) → visit ended; in between →
  nothing. Door exits win over location.
- **Live count**: checked-in members who haven't left, within the usual visit length; four hours for members who came
  in through a door reader today (readers catch exits); or seen at the gym by the app in the last 30 minutes.

## Live occupancy

Dashboard → **Live** (front desk and up, feature `live_occupancy`) and a "Right now at the gym" card on the member's
Home. `gym_occupancy(gym)` uses the best source available: a people counter that reported in the last 15 minutes
(its count, or entries minus exits since midnight), else entry and exit doors (members whose last door event
today was an entry, at most 4 hours old), else check-ins within the gym's usual visit length
(`gyms.avg_visit_minutes`, default 75). The level (quiet, moderate, busy, full) compares with `gyms.capacity`, or
without one, with the busiest usual hour. `gym_busy_hours(gym)` averages the last 8 weeks by weekday and hour.
People counters post to `/api/occupancy/<counter token>`: `{"people": 23}`, `{"in": 3, "out": 1}`, or a
Hikvision people-counting event. Tests: `supabase/tests/occupancy_test.sql`.

## Door access (ZKTeco and Hikvision)

Dashboard → **Access** (owners and managers, feature `access_control`). Gymix decides who may open which door;
every device is kept in step with memberships and payments (`supabase/migrations/*_access_control.sql`).

- **Who gets in**: `access_valid_until(member, device)` is the membership's last day while the member may enter
  (active, not frozen, visits left, nothing overdue, not archived, plan allowed in the device's zone), else null.
  Each member has a door number (`members.access_pin`, the user ID on every device) and may have a card.
- **Zones** group doors (Ladies area, Pool). A plan that lists zones opens only those; a plan without zones opens
  every door. Doors without a zone are open to every plan.
- **Keeping devices in step**: triggers on memberships, payments, invoices and members call `access_sync_member`,
  which compares with `access_grants` (what each device was last told) and queues the difference in
  `access_commands`. Each device is also brought up to date once a day (on its first call, the bridge's report, or
  the nightly `/api/cron/access`), because memberships end and invoices fall overdue without any row changing.
- **ZKTeco** terminals use their cloud-server (ADMS push) setting pointed at the Gymix domain, port 443, HTTPS:
  `/iclock/cdata` (handshake, attendance, enrolments), `/iclock/getrequest` (commands), `/iclock/devicecmd`
  (results), identified by serial number. Expired members are deleted from the device; their fingerprints and
  faces (uploaded at enrolment) are kept in `access_biometrics`, copied to the gym's other ZKTeco doors and restored
  on renewal. Cards enrolled on a device are saved to the member.
- **Hikvision** (ISAPI, digest auth): Gymix plans the requests (`web/src/lib/access/hikvision.ts`, with fallbacks
  for older firmware). Each person is stored with a validity period ending on the membership's last day, so the
  device refuses expired members even offline; blocking sets a past period (face kept). Events arrive at
  `/api/access/hikvision/<device token>`. Devices reachable from the internet are sent commands directly (after
  each change, on events, nightly); otherwise through the bridge.
- **Gymix Bridge** (`web/public/downloads/gymix-bridge.mjs`, Node 18+, no dependencies): runs on a gym computer,
  polls `/api/access/bridge` with the gym's token, runs the planned requests on local Hikvision devices, reports
  them online, points their event notifications at itself and relays events to Gymix, and relays ZKTeco push
  traffic for terminals without HTTPS (port 8091). Access → Gymix Bridge → Download for Windows gives a `.cmd`
  with the gym's address and token filled in.
- **Opening a door** (`*_open_door.sql`, `web/src/app/door-actions.ts`): owners, managers and front desk press
  **Open door** (the door icon next to the bell, or the door's page); members tap the door's own NFC sticker
  (`/d/<tap_token>`, link on the door's page), which checks them in and opens the door if their membership allows
  that zone (exit doors open for any member, without a check-in). An `open_door` command jumps the queue and
  expires after 15 s, so a door never opens late and is never retried. ZKTeco gets `AC_UNLOCK`, Hikvision
  `PUT /ISAPI/AccessControl/RemoteControl/door/<n>`. ZKTeco devices (`Delay=2` at the handshake; restart devices
  connected earlier) and the bridge ask for work every 2 s, so the door opens in about 1–3 s; directly reachable
  Hikvision devices open at once. Every opening is listed on the door's page with who asked. Staff open doors with **slide to open** (a handle that
  follows the thumb; letting go early springs it back), so a stray tap never opens a door.
- **Sticker security** (`*_door_security_and_polling.sql`): Access → Phone taps → "Only when the phone is at the
  gym" saves the gym's location (`set_door_location`); taps then send the phone's location and `door_tap` refuses
  anything farther than the radius (the phone's stated accuracy is allowed for, up to 150 m). Members get at most 12
  openings in 10 minutes.
- **Polling cost**: each ZKTeco `getrequest` is one database call (`access_zk_poll`), and so is each bridge poll
  (`access_bridge_poll`); "last seen" is written at most every 15 s. The bridge (Node 22+) also listens on a Supabase
  Realtime broadcast channel named after a hash of its token: an opening sends it a signal (`nudgeBridge`), so it
  polls every 10 s instead of 2 (still inside an opening's 15 s), and drops back to 2 s whenever the channel is down.
- **Entries** become check-ins (source `device`) at the event time; exits are kept for live occupancy. If a device
  lets in someone Gymix wouldn't, the check-in is recorded as refused and the device is corrected.
- **Tests**: `supabase/tests/access_test.sql`, and against a running app and local database
  `node web/scripts/test-access-e2e.mjs` (a simulated ZKTeco terminal, a mock Hikvision device and the real
  bridge; seed first with `node web/scripts/qa-seed.mjs`).

## Automatic WhatsApp

Sent through Meta's WhatsApp Cloud API (`web/src/lib/whatsapp.ts`), never by opening WhatsApp on a phone (there
are no wa.me links to members). Each gym chooses the sender in **Settings → WhatsApp**:

- **Gymix number** (default): the keys in `/admin` (Gyms) or `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`.
- **Their own number**: the owner pastes their phone number ID, WhatsApp Business account ID and a permanent
  system-user token. Gymix checks them with Meta, creates the templates on their account
  (`gym_whatsapp_accounts`, server-only) and switches to their number. Any template Meta hasn't approved there yet
  still goes out from the Gymix number, so nothing is missed.

Messages (`whatsapp_log`; the automatic ones at most once each, unique on kind + ref):

- **Renewal reminder**: a daily Vercel cron (`/api/cron/whatsapp`, 07:00 UTC, protected by `CRON_SECRET`) messages
  members whose membership ends in the gym's "renewal reminder" days (Settings, default 3, 0 = off).
- **Payment receipt**: when staff sell a membership with a payment or record a payment.
- **Welcome**: a new member added with a phone gets their one-tap portal login link.
- **Invite link** and **login details**: the "Send on WhatsApp" buttons (member profile, new password, and a member
  sending their own first login to themselves). One per member and kind every 30 seconds.

**Message log** (Settings → WhatsApp): every message with time, member, type, number, sender, the text (passwords
masked) and status, with filters and totals for 30 days. Statuses come from Meta's webhook
(`/api/whatsapp/webhook` for the Gymix app, `/api/whatsapp/webhook/<token>` for a gym's own app), signed with
the app secret; they only move forward (sent → delivered → read) and a failure keeps Meta's reason.

Templates (Utility, English; Gymix creates them: "Create or check templates" in `/admin`, or on connecting a
gym's number). Meta refuses a template that starts or ends with a variable.

- `gymix_renewal_reminder`: Hi {{1}}, your {{2}} membership ends on {{3}}. Renew at the front desk to keep training.
- `gymix_payment_received`: Hi {{1}}, {{2}} received your payment of {{3}}. Thank you!
- `gymix_member_welcome`: Hi {{1}}, {{2}} has set up your Gymix account. Open your member app here: {{3}} (one tap, nothing to sign up for).
- `gymix_login_details`: Hi {{1}}, here is your {{2}} member app login. Log in with {{3}} and the password {{4}} at {{5}} and keep this message private.

Tests: `supabase/tests/whatsapp_test.sql`. `WHATSAPP_GRAPH_URL` points the app at a mock of the Meta API (tests only).

## How access works

Every user has a role per gym: `owner`, `manager`, `front_desk`, `trainer` or `member` (`dietitian` still exists in the database; see Nutrition and Nutrix).
Staff land on `/dashboard`, members on `/portal`, users with no gym on `/onboarding` (create a gym → become its owner).

- Staff invite people by email on **Team & members**. The invite is claimed automatically when that email signs up or logs in.
- Who can invite/assign which role: owner → anyone but owner; manager → front desk, trainer, member; front desk → member.
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

## Nutrition and Nutrix

Nutrition is moving to a separate app, Nutrix, so Gymix no longer shows any nutrition screens or offers the
dietitian role. Everything underneath stays: the `nutrition_requests`, `nutrition_plans` and `nutrition_meals`
tables, their rules and the `dietitian` role (existing dietitian accounts still sign in), and
`supabase/tests/nutrition_test.sql` keeps them tested. `web/src/lib/nutrition.ts` still reads a plan. Old links to
`/portal/nutrition` and `/dashboard/nutrition` redirect home.

Connecting the two apps later (not built): give each gym a key for Nutrix (stored hashed, owner-only, revocable),
put it behind a `nutrix` feature switch, and expose a small versioned API (`/api/integrations/nutrix/v1/...`) that
reads members, body measurements and the existing nutrition plans so Nutrix can take them over.
