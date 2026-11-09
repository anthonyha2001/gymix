# Gymix: Marketing Brief

> **Who reads this:** an AI marketing assistant (ChatGPT, Claude, Gemini or any other tool) that writes content,
> plans campaigns and answers questions about Gymix. Read the whole file before you write anything. It is the
> single source of truth about the product. If something you want to say is not in this file, do not say it as a
> fact. Ask the founder, or mark it `[TO CONFIRM]`.
>
> **Goal:** make Gymix the gym software most gyms in Lebanon use: the default answer when a Lebanese gym owner asks
> "what do you use to run your gym?"
>
> **Last checked against the product:** 9 November 2026.

---

## 0. Placeholders to fill in

These details are not set yet. Use the placeholder in drafts and never make up a value.

| Placeholder | What it is |
|---|---|
| `[WEBSITE]` | Public website address (the sign-up page is `[WEBSITE]/signup`, pricing is `[WEBSITE]/pricing`, the live demo is `[WEBSITE]/demo`) |
| `[WHATSAPP_SALES]` | Gymix sales/support WhatsApp number |
| `[INSTAGRAM]`, `[TIKTOK]`, `[FACEBOOK]`, `[LINKEDIN]` | Social handles |
| `[FOUNDER_NAME]` | Name used to sign posts and emails (the founder is Anthony Hasrouny; confirm before using the name publicly) |
| `[CUSTOMER_NAME]`, `[CUSTOMER_GYM]`, `[QUOTE]` | Real customer testimonials. **There are none yet. Never invent one.** |

---

## 1. Gymix in one sentence

**Gymix is the all-in-one system for running a gym in Lebanon: memberships, payments in dollars and lira,
tap-your-phone check-in, trainer programs and a member app, for $19.99 a month for the whole gym.**

### Short versions (use as they are)

- **3 words:** Run your gym.
- **Tagline (from the website):** *Run your gym. Keep them coming back.*
- **Category line:** The operating system for gyms in Lebanon.
- **One-liner for owners:** Replace the notebook, the spreadsheet and the WhatsApp groups with one system.
- **Price line:** $19.99 a month for the whole gym. Less than one member's monthly fee.
- **Close:** Your gym, running itself.

---

## 2. Product facts (what Gymix really does)

Everything in this section is built and live for every gym today. You may claim any of it.

### 2.1 How it's delivered

- **A web app.** It runs in the browser on a computer, tablet or phone. Nothing to install for staff.
- **The member app is a PWA (Progressive Web App).** Members get a link (usually on WhatsApp). It opens straight
  away and can be added to the home screen like a normal app, on iPhone and Android. It is **not** in the App
  Store or Google Play, and that is a selling point: no download, no store, no password to remember.
- **Setup takes about 10 minutes:** create the gym, add membership plans, invite staff, add members as they walk in.
- **Anyone can try it first, with no sign-up:** the live demo at `[WEBSITE]/demo` (see 2.5).
- **The servers are in Frankfurt (EU),** so it's fast from Lebanon.

### 2.2 The staff dashboard (owner, manager, front desk, trainer)

**Members and memberships**
- Sell **monthly, yearly or visit-pack** memberships (for example, 10 visits).
- Freeze, resume and renew. Expiry is tracked for you.
- The overview shows active members, today's check-ins, memberships **expiring in the next 7 days**, money
  collected this month and **money members owe**.

**Money in dollars and lira (a key advantage in Lebanon)**
- Prices and invoices are in **USD**.
- The front desk takes payment in **cash, card, Whish or OMT**, including **cash in lira at the gym's own exchange
  rate**, which the owner updates whenever it changes.
- Invoices, payments, and who owes what.

**Unpaid? Frozen. (automatic debt control)**
- If a member still owes money a set number of days after an invoice (3 by default, the owner chooses), their
  account **freezes automatically**: the member app only shows its home page and **check-in is refused** at the door.
- The next check-in after paying unfreezes it.
- The same lock applies when a membership has ended, is paused, hasn't started, or the visits are used up.
- Why it matters: owners stop chasing people and stop losing money to "I'll pay you next week".

**Tap to check in (NFC + QR)**
- One **NFC sticker (about $1)** at the entrance. Members tap their phone and walk in.
- Members without NFC scan a QR code from their app.
- The owner writes the check-in link onto the sticker from their own phone. **No turnstile, no card reader, no
  hardware to buy.**
- Unpaid or expired members are stopped and sent to the front desk.

**Machines that teach**
- The owner lists the gym's real machines and equipment.
- Each machine can get an **NFC or QR sticker** (made and printed from the dashboard). Tapping it opens a how-to
  sheet in the member app with **how to use the machine, an exercise demonstration and the member's last weights
  on it**.
- Programs only use exercises for equipment the gym actually has.

**Schedule, classes and courses**
- A day, week and month calendar (a simple list on phones), with quick add.
- Classes with **bookings and waitlists**, **personal training**, and **monthly courses** (Pilates, Zumba, boxing
  and so on).
- Trainers only see their own classes.

**Programs from trainers**
- Members ask for a program in the app. The trainer builds it with the gym's real machines and it shows up in the
  member's app.
- Members can also build their own.

**Chat**
- Staff chat with members inside Gymix.
- The chat also shows the automatic WhatsApp messages each member was sent, with time and delivery status.

**Automatic WhatsApp** (sent by Gymix itself: nobody at the front desk sends anything from their own phone)
- **From the Gymix number by default, or from the gym's own WhatsApp Business number.** A gym that has its own
  WhatsApp Business API account (from Meta) can connect it in Settings, and its members then get the messages from
  the gym's own number and name. Gymix creates the message templates on the gym's account for it.
- **Renewal reminders** a number of days before a membership ends (3 by default, the owner chooses, 0 turns it off).
- **Payment receipts** when the front desk records a payment.
- **Welcome message** with a one-tap login link when a new member is added.
- **Invite links and login details** sent with one button ("Send on WhatsApp") from the member's profile.
- **A message log** for the owner: every message sent, to whom, from which number, and whether it was delivered and
  read (or why it failed), with filters.
- Each automatic message is sent once, never spammed.
- `[TO CONFIRM with founder]` before advertising WhatsApp as working today: the Gymix WhatsApp number and its
  message templates must be connected and approved by Meta first.

**Team roles and privacy**
- Roles: **owner, manager, front desk, trainer** (and member).
- Each sees only what they need. **Trainers don't see money.** Members only see their own records.
- Who can invite whom is controlled (for example, the front desk can only add members).
- **Each gym's data is separated in the database itself**, not just hidden on the screen. The Gymix team only sees
  totals, never a gym's member details.

**Help when you need it**
- If an owner is stuck, Gymix support can open their dashboard (with a clear banner showing it) and fix it with
  them. Nothing to set up.

### 2.3 The member app (Home, Train, Schedule, Progress, More)

- **Home:** today's workout, weekly goal and **streak**, membership and days left, next class, invoices.
- **Train:** their programs, plus a **workout logger** with a rest timer and **personal-record alerts with confetti**.
- **Training days:** members pick the weekdays they train and which program day goes with each one, and get a
  reminder on those days.
- **Schedule:** book classes, join waitlists.
- **Progress:** body measurements and lifting progress over time.
- **Messages:** chat with the gym or their coach.
- **Pause themselves:** travelling or injured? Members pause their membership from the app and resume it later. The
  paused days are added to the end date. Fewer front-desk calls.
- **The owner chooses which member-app pages are visible.**
- **Fun touches people talk about (good for social video):**
  - **Shake the phone three times quickly** and the Programs page opens behind a lime-green wave.
  - **Drop the phone** (it falls and hits something): the screen "cracks", heals itself, and a joke pops up. There
    is a "Try it" button on the Profile page.
  - Small animations everywhere: cards slide in, sets "pop" when checked, confetti on records. All of it turns off
    when the phone asks for reduced motion.

### 2.4 Pricing (exact)

- **$19.99 a month per gym.** Not per member, not per staff member. **Unlimited members and staff, every feature
  included.** One plan only.
- **14-day free trial. No card needed.**
- **No setup fee. No contract.** Stop whenever you like. The data is never deleted.
- **How gyms pay:** **Whish, OMT or bank transfer**, for one month or several at once. There is no card payment
  online; Gymix records the payment by hand.
- **If a gym stops paying:** reminders first; 3 days after the subscription ends the **staff dashboard locks**
  until they renew. **Members can keep using their app in the meantime.** Nothing is deleted.
- Note: the price, trial length and grace period can be changed by Gymix. If a campaign uses a different offer
  (for example "first 3 months for $20"), the founder must confirm it first. Never invent discounts.

**What's included (the official list):**
1. Unlimited members and staff
2. Memberships, invoices and payments in USD and LBP
3. NFC tap and QR check-in
4. Member app for iPhone and Android
5. Programs built by your trainers
6. Classes, monthly courses and personal training
7. Machine stickers with how-to animations
8. Calendar schedule with bookings
9. Automatic WhatsApp reminders and receipts
10. Notifications and reminders
11. Automatic freeze for unpaid accounts


### 2.5 The live demo (`[WEBSITE]/demo`)

The strongest way to show Gymix. Use it as the main call to action wherever a sign-up feels like too big a step.

- **One button, no sign-up, no email.** The visitor gets their **own private sample gym, "Atlas Fitness"**, inside the
  real Gymix (not a video, not screenshots), signed in as the owner.
- It's **full of realistic data**: 25 members (active, ending soon, expired, paused, owing money), payments in
  dollars and lira by cash, Whish, OMT and card, three weeks of check-ins, weekly classes with bookings, a trainer
  program, a shop, a member chat and staff invites.
- **A guide walks them through every page**: what it's for and what to try (for example "check in Tarek: his
  membership expired, so Gymix refuses him and says why"). The next page to visit glows in the menu.
- **They can switch to the member's phone** (Karim's app) and back, to see what members see.
- They can **click and change anything**. Nothing is sent to anyone. The sample gym is deleted after 24 hours.
- From the demo, one button starts their real 14-day free trial.

**How to talk about it:** "Run a gym for a day", "Try it now, no sign-up", "Click anything, you can't break it".
**Don't say** the sample gym or its members are real, and don't promise data from the demo carries over to a real
gym (it doesn't: it's deleted).

---

## 3. What you must NOT claim (guardrails)

Breaking these damages trust in a small market where everyone talks. Follow them strictly.

| Do not say | The truth |
|---|---|
| "Available in Arabic" / "Arabic interface" | The app is **in English only** today. Marketing *content* can be in Arabic, Lebanese dialect, French and English, but don't say the app is. |
| "Download from the App Store / Google Play" | It's a web app installed from a link (PWA). Say "install it from a link, no store needed". |
| "Pay online by card" (for the Gymix subscription) | Gyms pay Gymix by Whish, OMT or bank transfer. (Gyms can *record* card payments from their members.) |
| "Online payments for members" / "members pay in the app" | Members can see their invoices in the app, but they pay at the front desk. |
| "Works with turnstiles / access-control gates / fingerprint readers" | Door access for ZKTeco and Hikvision devices is built but in testing (not live for gyms yet). Don't advertise it until the founder switches it on for everyone; then it can be said that Gymix works with ZKTeco and Hikvision face, fingerprint and card terminals. Today's check-in is the NFC sticker + QR. |
| "Shop / POS", "Gym TV screens", "Live occupancy / busy hours", "Self-service kiosk" | Built and in testing (not live for gyms yet). Don't advertise them until the founder switches them on for everyone. When live: a shop to sell supplements and drinks with barcodes and stock; TVs with classes, leaderboards and offers; how busy the gym is now and usual busy hours; a tablet at the entrance to check in, join and buy or renew. |
| "AI-powered" / "AI builds your program" | No AI features in the product. Trainers build programs; members can build their own. |
| "Used by X gyms" / "Trusted by the top gyms in Beirut" | No public customer numbers yet. Never invent numbers, logos or testimonials. |
| Fake reviews, fake screenshots of customers, made-up quotes | Never. Use `[QUOTE]` placeholders. |
| "Integrates with [any accounting or payment software]" | No integrations except WhatsApp. |
| "Wearables / Apple Health / Google Fit sync" | Not supported. |
| "Nutrition plans" / "meal plans" / "dietitian" | Not in Gymix. Nutrition is moving to a separate app, Nutrix, which is not launched. Don't mention it until the founder says so. |
| "Multi-branch management" / "franchise dashboard" | Each gym is its own account. Don't promise a multi-branch view. `[TO CONFIRM]` with the founder before targeting chains. |
| "Guaranteed more members / X% more revenue" | No guarantees. Talk about time saved, money collected and members who stay, without fake percentages. |
| Naming or attacking competitors | Don't name competitors in public content. Compare with "the notebook, Excel and WhatsApp groups" or "expensive foreign software". |

The live demo's gym and people ("Atlas Fitness", "Karim Aoun", "Fadi Germanos", "Lynn Tannous" and the rest) are also
made-up sample data. The demo names on the website ("Iron House", "Rami Haddad", "Lara Nassar", "Karim Saad", "Nour") are **made-up
examples**. Don't present them as customers.

If you're not sure whether a feature exists, write `[TO CONFIRM: does Gymix do X?]` instead of guessing.

---

## 4. The market: Lebanon

### 4.1 Why Lebanon, why now
- Gymix is built **for Lebanon first**: dollars and lira side by side with the gym's own rate, Whish and OMT,
  WhatsApp everywhere. Foreign gym software is usually priced per member in dollars by card and assumes one stable
  currency. That's the gap.
- Most small and mid-size Lebanese gyms still run on **a notebook at the front desk, an Excel sheet, and WhatsApp
  groups**. The competition is mostly habit, not software.
- Lebanon is small and runs on word of mouth. Owners, trainers and coaches know each other. **Winning a few
  respected gyms in each area creates a chain reaction.** Trainers move between gyms and bring tools with them.
- Phones are everywhere and WhatsApp is how business gets done, so the WhatsApp-first approach fits how people
  already work.

> For the AI: treat the market figures you know about Lebanon (number of gyms, population, economy) as
> **possibly out of date**. Don't publish statistics without a source the founder has checked.

### 4.2 Where to focus (suggested order)
1. **Greater Beirut and Metn** (Achrafieh, Hamra, Verdun, Mar Mikhael, Badaro, Jdeideh, Dbayeh, Antelias,
   Jal el Dib, Zalka, Sin el Fil, Hazmieh, Baabda): the most gyms and the most open to new tools.
2. **Keserwan and Jbeil** (Jounieh, Kaslik, Zouk, Byblos).
3. **The North and the South** (Tripoli, Batroun, Saida, Tyre) and **the Bekaa** (Zahle, Chtaura).
4. Then (later): the Lebanese diaspora's gyms and the wider region. **Not a current focus. Lebanon first.**

### 4.3 Who we sell to (target gyms)
- **Independent gyms with 50 to 1,000 members.** The sweet spot.
- **Boutique and class studios:** CrossFit boxes, Pilates/reformer studios, boxing and MMA clubs, dance and Zumba
  studios, women-only gyms, martial arts academies.
- **Neighbourhood gyms** that run on cash and a notebook today.
- **Personal trainers and small PT studios** with a client list.
- **Hotel, university and club gyms** (secondary).
- **Gym chains with several branches:** later. See the multi-branch note in section 3.

---

## 5. Who we're talking to (personas)

### Persona A: The owner-operator ("Elie", 35-50)
- Owns one gym, often trains or works the front desk himself. Runs everything on WhatsApp.
- **Pains:** members who don't pay or "forget" for weeks; losing track of who expired; the dollar/lira mess;
  front-desk staff who make mistakes or let friends in for free; no time.
- **Wants:** collect money, see the numbers, save time, look professional.
- **Fears:** "it's complicated", "my staff won't use it", "my members won't download an app", "another monthly
  bill", "it's expensive foreign software".
- **What gets him:** *Unpaid? Frozen.* + *$19.99 a month* + *10-minute setup* + *dollars and lira*.

### Persona B: The boutique studio founder ("Maya", 27-40)
- Pilates, CrossFit, boxing or dance studio. Brand-conscious, lives on Instagram.
- **Pains:** class bookings by DM, no-shows, waitlists in her head, monthly course payments, looking less
  professional than she is.
- **Wants:** a beautiful app for her members, bookings and waitlists, a premium feel.
- **What gets her:** the member app, the class calendar with waitlists, monthly courses, the look of it.

### Persona C: The manager or front desk ("Joe", 22-35)
- Uses the system all day. Influences the owner's decision.
- **Pains:** writing everything in the notebook, arguments at the door over unpaid fees, the lira calculator.
- **What gets him:** tap check-in that blocks unpaid members (no more awkward conversations at the door), payment
  receipts sent automatically, finding a member in seconds.

### Persona D: The trainer or coach ("Karim", 22-40)
- Sends programs as photos, PDFs or voice notes.
- **What gets him:** programs that appear in the client's app on the gym's real machines, client progress in one
  place. Trainers who like Gymix tell owners.

### Persona E: The gym member (end user, 16-45)
- Not the buyer, but the best marketing channel. When members love the app, other gyms' members ask for it.
- **What gets them:** tap in with your phone, today's workout on the home screen, streaks, PR confetti, the shake
  trick, the cracked-screen joke, pausing their own membership when they travel.

---

## 6. Positioning and messaging

### 6.1 Positioning statement
For **gym owners in Lebanon** who run their gym on notebooks, Excel and WhatsApp, **Gymix** is the **gym
operating system** that **collects your money, checks members in with a tap and gives every member an app**,
in dollars and lira, for **$19.99 a month**. Unlike foreign gym software priced per member and paid by card, Gymix is
**built for how Lebanese gyms really work**.

### 6.2 Message pillars (every piece of content supports at least one)

1. **Get paid.** *Unpaid? Frozen.* Automatic freeze, renewal reminders on WhatsApp, receipts, who owes what,
   dollars and lira at your rate.
   - Proof points: auto-freeze after N days; check-in refused at the door; reminders N days before expiry.
2. **Save time.** Set up in 10 minutes. No more notebook. Members pause themselves, get their own login link,
   and book their own classes.
3. **Keep members coming back.** A member app they actually open: today's workout, streaks, records,
   programs from their trainer, classes and progress. *Keep them coming back.*
4. **Built for Lebanon.** USD + LBP with your own rate, Whish/OMT, WhatsApp, fast servers, local support that
   can open your dashboard and help.
5. **Ridiculously fair price.** $19.99/month for the whole gym. Unlimited members. No card, no contract, 14 days free.

### 6.3 Key phrases to reuse
- "Replace the notebook, the spreadsheet and the WhatsApp groups."
- "Unpaid? Frozen."
- "A $1 sticker is all the hardware."
- "$19.99 a month. Less than one member's fee."
- "No card needed. Set up in ten minutes."
- "Your members tap their phone and walk in."
- "An app your members actually open."
- "If it doesn't save you time in the first week, don't pay." (This is the website's promise and matches the free
  trial.)

### 6.4 Objection handling

| Objection | Answer |
|---|---|
| "My members won't download an app." | They don't download anything. You send them a link on WhatsApp; one tap and they're in. They can add it to their home screen. |
| "It's too complicated for my staff." | Setup takes 10 minutes. Each role only sees what it needs; the front desk sees members, payments and check-ins. And our support can open your dashboard and help you directly. |
| "I don't have money for software." | $19.99 a month for the whole gym. If the auto-freeze collects even one unpaid month from one member, it has paid for itself. |
| "What about the lira?" | Prices in dollars, take lira at your own rate, change the rate whenever you want. |
| "I don't have a card to pay you." | You don't need one. Pay by Whish, OMT or bank transfer. |
| "What do I need to buy for check-in?" | Nothing except NFC stickers at about $1 each. Members without NFC scan a QR code. |
| "What if I stop paying?" | No contract. Your data is never deleted; the staff dashboard locks until you renew, and your members can still use their app. |
| "Is my data safe? Will you see my members?" | Each gym's data is separated in the database itself. The Gymix team only sees totals, never your members' details. |
| "I already use Excel / WhatsApp groups and it works." | It works until someone forgets to pay for three months. Gymix does the chasing for you and freezes them automatically. Try it free for 14 days alongside your notebook. |
| "Is it in Arabic?" | Honest answer: the app is in English today; it's simple and visual, and most members and staff use it easily. `[TO CONFIRM: is Arabic planned? If yes, say "Arabic is coming"]`. |
| "I have three branches." | `[TO CONFIRM with founder]`. Don't promise a multi-branch view. |

---

## 7. Brand

### 7.1 Visual identity
- **Logo:** a "G" with contactless tap waves (it stands for tap check-in) in a rounded lime square, next to the
  word **Gymix** in bold.
- **Colours:**
  - **Lime (brand):** `#C8F135`; darker lime `#A9D10F`
  - **Ink (near black):** `#0D1117`
  - **Canvas (warm off-white):** `#F4F5F2`; white `#FFFFFF`
  - **Lines/grey:** `#E2E4DE`, muted text `#5D6470`
  - **Success green:** `#1F7A3F`; **danger red:** `#C0362C`
- **Look:** dark ink backgrounds with lime highlights, rounded cards, a lot of white space, clean modern sans-serif,
  bold short headlines. Energetic, not aggressive. Think premium sports tech, not a bodybuilding poster.
- **Imagery:** real Lebanese gyms and real people (not stock bodybuilders), phones tapping a sticker at the door,
  the front desk, a trainer with a client, the member app on a phone. Lime used as an accent.

### 7.2 Voice: the smart, teasing Lebanese friend

**Gymix talks like the friend who has run a gym in Lebanon for ten years, has heard every excuse, teases you about
it with love, and then quietly fixes it.** Smart first, funny second, Lebanese all the way through. Owners should read
a post, laugh, think "wallah, that's my gym", and tap the link.

#### The character
- **Sharp, not loud.** The joke comes from noticing something true that nobody says out loud. No shouting, no
  "🔥🔥🔥 GAME CHANGER", no clown energy.
- **Teasing, with love.** We roast the *situation* (the notebook, the excuses, the chaos), never the person. The owner
  is always the hero; the problem is the villain.
- **Confident and a bit cheeky.** We know the product works; we don't beg. "Try it. Break it. It's not your gym (yet)."
- **Lebanese by instinct.** Code-switching (Hi, kifak, ça va), everyday phrases, the rhythm of how people actually talk
  at a front desk in Achrafieh or Jounieh. Never a tourist's version of Lebanon.

#### The recipe for a smart line (use it for every hook, caption and ad)
1. **The truth:** something every Lebanese gym owner knows is real. ("He's been saying 'bkra' since October.")
2. **The twist:** a tease, a reveal or a play on words. ("Bkra bedfa3? Tayyeb. W bkra btfout.")
3. **The fact:** one product fact from section 2, exactly as written. ("Unpaid members freeze automatically.")
4. **The nudge:** the call to action, light. ("Try it on a sample gym, no sign-up.")

One joke per piece, then get out. If you have to explain it, cut it.

#### The brand character: Detective Bob
**Detective Bob is Gymix's recurring character** (chosen by the founder, 9 November 2026). A calm, sharp noir
detective in a charcoal trench coat and a fedora with a lime band; short beard, never raises his voice. Every story
is a *case*: a gym is losing money, time or members, Bob investigates the clues (the notebook, the lira rate, 40
unread chats, January members vanishing), names the real culprit (no system), and closes the case with Gymix.
- **Format:** illustrated carousels ("Case #001, #002…"), noir look: night blues, rain, a lime accent, case files,
  exhibits, an evidence board, a "CASE CLOSED" stamp. Drawn in `marketing/studio/` (see `carousels/bob-case-001.html`).
- **His voice:** short, dry, smart. "Money doesn't vanish, kid. It just stops being written down."
- **Never:** Bob doesn't mock members or owners; the villain is always the situation (no system).
- **Abou Bkra is retired** (the founder asked to stop using him). Don't use Abou Bkra in new content.

Other bits that still work as clues in Bob's cases: **el daftar** (the front-desk notebook), **January members**,
**the wasta member**, **the rate question** ("kam el sa3er lyom?"), **the trainer's 11pm PDF**, **40 chats**.
All are fictional types, never real people, never named after a real member or gym.

#### The hook bank (use, remix, test; dialect lines NEED NATIVE CHECK)
**Getting paid**
- "Bkra bedfa3? Tayyeb. W bkra btfout." (Pay tomorrow? Fine. And you get in tomorrow.)
- "El freeze ma bya3ref wasta."
- "Unpaid? Frozen. Paid? Welcome back, habibi."
- "The only thing in your gym that never skips a day: the auto-freeze."
- "Your front desk deserves better than 'ma3leh, bkra'."
- "Collecting fees shouldn't need a speech, a guilt trip and a cousin."

**The notebook and the chaos**
- "40 WhatsApp chats. 3 notebooks. 1 calculator. 0 idea who paid. Or: one app."
- "El daftar did its best. It's time."
- "Your notebook can't send reminders. It also can't count. Respectfully."
- "Kam el sa3er lyom? Set it once. Gymix does the maths. You do the gym."

**Check-in**
- "A $1 sticker at the door. Tap, you're in. Didn't pay? The sticker knows."
- "Members tap their phone at the door like it's a metro in Paris. Except it's your gym in Zalka."
- "No turnstile, no installer, no 'el technician jeye bokra'."

**Members and retention**
- "January members are like New Year's resolutions. Gymix sends the reminder before they become February ghosts."
- "Your members already live on their phones. Now your gym does too. No App Store, no download, no 'shou el password?'"
- "Streaks, PRs, confetti. Your members will come back just to not lose the streak. We don't judge."

**Price**
- "$19.99 a month for the whole gym. Less than one member's monthly fee. Way less than one member's excuses."
- "$19.99. Not per member. Not per trainer. Not 'call us for a quote'. Per gym. Khalas."

**The live demo**
- "Run a gym for a day. No sign-up, no salesman, no 'n7ki ba3den'."
- "Try it. Break it. It's not your gym (yet)."
- "Check in a member. Freeze another one. Sell a membership. All before your coffee gets cold."

#### Smart, not cringe: the checks
- **Truth first.** Every joke stands on a real owner's problem and a real Gymix fact. No fact, no joke.
- **One language switch per line is plenty.** "Unpaid? Frozen. Paid? Welcome back, habibi." Not a word salad.
- **No forced slang, no emoji spam** (one emoji at most in a social caption, none in ads or designs).
- **Read it out loud in a Lebanese accent.** If a gym owner in Jdeideh wouldn't say it, rewrite it.
- **Variety:** not every post is a joke. Mix in useful owner tips and straight product clips (section 10.1).

#### How playful, by channel
| Channel | Playful | Notes |
|---|---|---|
| Ads | Medium | One clever hook, then the facts and the CTA. Clarity wins the click. |
| WhatsApp to new owners | Light | Warm, one light line max. Respect their time. |
| Website, one-pager, emails | Light | Clear first; one smart line per section. |
| Onboarding and support | Warm, almost none | Never tease someone who is stuck, paying or upset. Be quick and kind. |
| Press, LinkedIn | Low | Smart and confident, not jokey. |

#### Never tease
- People's bodies, weight, looks, age or gender. (No "summer body" shaming, ever.)
- Religion, sects, regions as stereotypes, politics, the crisis, money troubles, power cuts, emigration.
- Customers in support, or any real member or gym.
- Competitors by name (tease "the notebook" and "expensive foreign software" instead).
- Anything that would embarrass an owner if their members saw it.

**Never use:** corporate buzzwords ("revolutionary", "cutting-edge", "synergy", "leverage", "game-changer") and fear
tactics.

### 7.3 Languages
Lebanon is multilingual. Match the language to the channel and audience:
- **English:** the website, LinkedIn, B2B emails, the default.
- **Lebanese Arabic (dialect), in Arabic script or Arabizi (Latin letters and numbers: "3a", "7", "2")**:
  Instagram/TikTok captions, Reels voice-overs, WhatsApp messages to owners. This sounds the most local and natural.
  Mixing in English and French words ("yalla", "merci", "ok") is normal and good.
- **Modern Standard Arabic:** only for formal pieces (press, print ads aimed at a wider audience). Avoid it on
  social; it sounds stiff.
- **French:** some owners and areas prefer it; good for some emails and posts.
- Keep product names and feature names in English inside any language ("tap check-in", "member app",
  "Whish", "OMT").

Example of the right tone in Lebanese dialect (Arabizi):
> "Kel chahr, el masari 3am tdi3 men el gym? Detective Bob la2a el moshkle: ma fi system. Ma3 Gymix, li ma dafa3
> bya3mol freeze la7alo, w el freeze ma bya3ref wasta. $19.99 bel chahr la kel el gym. Jarreb 3a gym demo, bala ma
> tsajjel."

(Translation: "Every month, money keeps disappearing from the gym? Detective Bob found the problem: there's no
system. With Gymix, whoever didn't pay freezes automatically, and the freeze doesn't know any wasta. $19.99 a month
for the whole gym. Try it on a demo gym, no sign-up.")

The AI should get a Lebanese speaker to check dialect copy before it's published.

---

## 8. The plan to win Lebanon

### 8.1 Goals (suggested, the founder sets the real numbers `[TO CONFIRM]`)
- **Phase 1 (months 0-3): First 30 gyms.** Prove it works, collect 5-10 real testimonials and case studies.
  Focus: Beirut + Metn.
- **Phase 2 (months 3-9): 150 gyms.** Referral engine, trainer ambassadors, expand to Keserwan, Jbeil, North,
  South, Bekaa.
- **Phase 3 (months 9-18): The default.** Most independent gyms and studios in Lebanon. "Gymix" becomes the word
  people use for gym software.

### 8.2 Funnel
1. **Awareness:** Instagram/TikTok Reels, gym-owner WhatsApp and Facebook groups, trainers, members seeing the app
   at other gyms.
2. **Interest:** the website, **the live demo at `[WEBSITE]/demo` (no sign-up, the best converter)**, a WhatsApp
   chat with `[WHATSAPP_SALES]`.
3. **Trial:** a 14-day free trial at `[WEBSITE]/signup`, no card. **Offer to set it up together**, in person or on
   a call (white-glove onboarding is a huge advantage in a small market).
4. **Activation (critical):** during the trial the gym must (a) add its plans, (b) add members, (c) stick the
   check-in sticker at the door, (d) send members their WhatsApp login links. A gym that does all four almost
   always stays. The dashboard shows a setup checklist for exactly these steps.
5. **Payment:** a Whish/OMT/bank transfer at the end of the trial.
6. **Referral:** a happy owner introduces another owner.

### 8.3 Channels and tactics

**A. Direct and in person (the most effective in Lebanon)**
- **Walk into gyms** with a phone and an NFC sticker. A 2-minute demo: tap the sticker, it checks in; show a frozen
  member being stopped. Or open `[WEBSITE]/demo` on the owner's own phone and let them click around. Leave a free
  sticker with a QR code to the demo or the trial.
- **"We set it up for you" offer:** visit the gym, add the plans and the first members, stick the sticker. Done in
  30 minutes.
- Bring **printed one-pagers** (see section 9) and **branded NFC stickers**.

**B. WhatsApp (the main business channel in Lebanon)**
- A WhatsApp Business account for `[WHATSAPP_SALES]` with a catalogue, quick replies, a short demo video and the
  live demo link `[WEBSITE]/demo` as the first reply to anyone curious.
- Click-to-WhatsApp ads on Instagram and Facebook.
- Short voice notes from the founder for warm leads (very Lebanese, very effective).
- Respect people: no mass unsolicited messages to numbers that didn't agree; it gets the number banned and hurts
  the brand.

**C. Instagram and TikTok (awareness and members)**
- Short Reels: the tap check-in, "Unpaid? Frozen.", the shake trick, the cracked-screen drop joke, a day in the life
  of a gym owner before/after Gymix.
- Collaborations with **Lebanese fitness creators, coaches and gyms** (the creator's gym uses Gymix and shows it).
- Post 4-5 times a week. See the content calendar in section 10.

**D. Facebook**
- Lebanese gym-owner and trainer groups: be useful (tips on retention, collecting fees, pricing memberships),
  not spammy.
- Ads aimed at gym owners and managers in Lebanon (job titles, interests in gym management, fitness business).

**E. Trainers and coaches (ambassador programme)**
- Trainers move between gyms and talk to every owner. Give them a reason to recommend Gymix.
- `[TO CONFIRM with founder]`: a referral reward, for example a free month for the gym for every gym that signs
  and pays, and/or a cash or gift reward for the trainer. **Don't announce a reward before the founder confirms it.**

**F. Referral programme for gyms**
- `[TO CONFIRM]`: "Bring a gym, get a free month" for both gyms. Simple, easy to explain on WhatsApp.

**G. Partnerships**
- **NFC sticker suppliers / printers:** co-branded stickers.
- **Gym equipment sellers and installers:** they meet every new gym first. A Gymix leaflet with every installation.
- **Supplement shops and sportswear brands:** co-promotions and giveaways for members.
- **Fitness events, races and competitions** in Lebanon: a stand with a live tap check-in demo.
- **Universities' sports programmes and coaching certification courses:** the next generation of trainers and owners.

**H. Search and website (SEO)**
- Target searches like: "gym management software Lebanon", "gym system Lebanon", "برنامج إدارة نادي رياضي لبنان",
  "logiciel gestion salle de sport Liban", "gym membership app Lebanon", "NFC gym check-in".
- Blog articles (see section 10). A Google Business Profile.

**I. PR**
- The Lebanese startup story: a local product built for local gyms, priced fairly, solving the dollar/lira problem.
- Pitch Lebanese tech, business and lifestyle media `[the AI should research current outlets and the founder should
  check them]`.

### 8.4 Key metrics to track
- Demos started per week, and demo → trial conversion.
- Trials started per week, by channel.
- **Activation rate:** trials that complete the 4 setup steps.
- Trial → paid conversion.
- Paying gyms; monthly recurring revenue ($19.99 × paying gyms, unless the price changes).
- Churn (gyms that stop paying).
- Members added and check-ins per gym (shows real use).
- Referrals per paying gym.

---

## 9. Ready-to-use assets

Adapt these, but keep the facts exactly as they are.

### 9.1 Website hero (already live)
- **Badge:** Built for gyms in Lebanon
- **Headline:** Run your gym. **Keep them coming back.**
- **Subhead:** Gymix is the all-in-one system for your gym: memberships, payments in dollars and lira,
  tap-to-check-in, programs from your trainers and an app your members actually open.
- **CTA:** Start your 14-day free trial · $19.99 a month, all in
- **Second link:** Try the live demo, no sign-up
- **Under the CTA:** No card needed. Set up in ten minutes.
- **Proof strip:** $19.99 a month for the whole gym · USD + LBP with your own lira rate · $1 NFC sticker is all the
  hardware · 10 min to set up your gym

### 9.2 The 3 steps (already live)
1. **Create your gym.** Add your membership plans, prices and lira rate. Invite your managers, front desk and
   trainers.
2. **Invite members on WhatsApp.** Gymix sends each member a personal link. One tap and they're in their app, no
   password to remember.
3. **They tap in.** A sticker at the door checks them in. Unpaid? They're stopped and sent to the front desk.

### 9.3 One-pager (print / PDF)
**Title:** Your gym, running itself.
**Sub:** The all-in-one gym system built for Lebanon. $19.99 a month. 14 days free.
- **Get paid:** unpaid members freeze automatically, WhatsApp renewal reminders, receipts, dollars and lira.
- **Tap to check in:** a $1 sticker at the door. No hardware.
- **A member app:** programs, classes and progress. No store download.
- **Your whole team:** owner, manager, front desk and trainers, each with their own access.
- **CTA:** Try the live demo at `[WEBSITE]/demo`, start free at `[WEBSITE]/signup`, or WhatsApp `[WHATSAPP_SALES]`.

### 9.4 Cold WhatsApp message to an owner (only to people who have agreed to be contacted or who reached out first)
**English:**
> Hi [Name], this is [FOUNDER_NAME] from Gymix. We built a gym system for Lebanese gyms: members tap their phone
> at the door to check in, anyone who hasn't paid gets frozen automatically, and you take dollars or lira at your
> own rate. It's $19.99 a month for the whole gym and the first 14 days are free. You can try it right now with a
> sample gym, no sign-up: [WEBSITE]/demo. Or I can show you in 2 minutes when you're at the gym this week?

**Lebanese (Arabizi):**
> Marhaba [Name], ana [FOUNDER_NAME] men Gymix. 3amalna system lal gyms bi Lebnen: el members bya3mlo tap bel
> phone 3al bab, w li ma dafa3 bya3mol freeze la7alo, w btekhod dollar aw lira 3al sa3er li badak ye. $19.99 bel
> chahr la kel el gym, w awwal 14 yom free. Fik tjarrbo halla2 ma3 gym demo, bala ma tsajjel: [WEBSITE]/demo. Aw
> fik a3tik demo 2 minutes hal jem3a?

### 9.5 Instagram Reel scripts

**Reel 1: "Unpaid? Frozen." (15s)**
- 0-3s: a member taps his phone on the door sticker. A red screen: "Account frozen: unpaid".
- 3-8s: the front desk smiles, shrugs. Text: "No more awkward conversations."
- 8-12s: he pays. Taps again. Green: "Checked in. Welcome back."
- 12-15s: the logo. "Gymix. $19.99/month. 14 days free."

**Reel 2: "A $1 sticker vs a $2,000 turnstile" (20s)**
- Show the price of a turnstile (generic, no brand), then a $1 NFC sticker. Tap. Checked in.
- Text: "Same job. 2,000× cheaper." (Only use if the comparison is fair: say "a turnstile can cost thousands".)

**Reel 3: "Shake it" (10s, member-focused, fun)**
- A member shakes the phone 3 times, the lime wave fills the screen and the program opens.
- Text: "Your workout, one shake away." Trending audio.

**Reel 4: "Oops" (10s, viral potential)**
- A member drops the phone (onto a soft surface, safely). The screen "cracks"... then heals, and a joke pops up.
- Text: "Our app has jokes." Caption: tell people to try it from Profile → "Try it" (so nobody drops their phone on
  purpose).

**Reel 5: "Before Gymix / After Gymix" (20s)**
- Before: a notebook, a calculator, 40 WhatsApp chats, "kam el sa3er lyom?" (what's the rate today?).
- After: one dashboard: check-ins today, collected this month, who owes.

**Reel 7: "Run a gym for a day" (20s, owners)**
- Screen recording of the live demo: press "Start the demo", the sample gym appears, the guide card says
  "Welcome to Atlas Fitness".
- Quick cuts: check in a member, the expired one gets refused, sell a membership, switch to the member's phone.
- Text: "Try it now. No sign-up." End card: `[WEBSITE]/demo`.

**Carousel: Detective Bob, Case #001 "The Case of the Missing Dollars"** (10 slides, ready in
`marketing/studio/out/bob-case-001/` with its caption): money vanishes from a gym every month; the clues are the
notebook, three lira rates and 40 unread chats; the culprit is "no system"; Gymix closes the case.

**Reel 9: "El daftar retires" (20s)**
- A front-desk notebook gets a retirement party: balloons, a tiny cake, coffee stains on every page.
- Text: "After 7 years, 3 handwritings and 1 torn page, el daftar retires." End: the Gymix dashboard. "We'll take it
  from here."

**Reel 6: "The member's morning" (15s)**
- Notification "Leg day today 💪" → home screen with today's workout → tap at the door → log sets → PR confetti.

### 9.6 Ad copy

**Meta ad (owners), English**
- Primary text: Still chasing members for payments? Gymix freezes unpaid accounts automatically, checks members in
  with a tap, and handles dollars and lira at your rate. $19.99/month for the whole gym.
- Headline: Run your gym. Get paid.
- CTA: Send WhatsApp message / Sign up

**Meta ad (studios)**
- Primary text: Bookings, waitlists and monthly courses in one place, plus a beautiful app your members open every
  day. Built for studios in Lebanon. 14 days free.
- Headline: Your studio, running itself.

**Meta ad (live demo), English**
- Primary text: Don't take our word for it. Run a sample gym in Gymix right now: check members in, sell
  memberships, see who owes. No sign-up, nothing to install. $19.99/month when you're ready.
- Headline: Run a gym for a day.
- CTA: Learn more → `[WEBSITE]/demo`

**Google search ads**
- Headlines: Gym Management Software Lebanon | $19.99/Month, All Features | USD & LBP Payments | 14-Day Free Trial
- Descriptions: Memberships, tap check-in, member app, WhatsApp reminders. Built for Lebanese gyms. No card needed.

### 9.7 Email to a lead after a demo
**Subject:** Your Gymix gym is ready to set up
> Hi [Name],
>
> Thanks for your time today. As promised:
> - Want to look around again first? The live demo is here: [WEBSITE]/demo (no sign-up)
> - Start your free trial here: [WEBSITE]/signup (14 days, no card)
> - It takes about 10 minutes: add your plans, add your first members, stick the check-in sticker at the door.
> - Send your members their login links on WhatsApp straight from Gymix.
>
> If you want, I'll come by and set it up with you. Just reply or WhatsApp me on [WHATSAPP_SALES].
>
> [FOUNDER_NAME], Gymix

### 9.8 Trial nurture (WhatsApp or email, days of the 14-day trial)
- **Day 0:** Welcome + "do these 4 things" (plans, members, sticker, WhatsApp links).
- **Day 2:** "Did you stick the check-in sticker? Here's a 30-second video."
- **Day 4:** "Send your members their app links. They'll love it." Tip: the shake and drop tricks.
- **Day 7:** "Your first week: here's what Gymix did for you" (check-ins, money collected, reminders sent).
- **Day 11:** "3 days left. Pay by Whish, OMT or bank transfer to keep going."
- **Day 14:** "Your trial ends today. Your data is safe; renew any time."

---

## 10. Content calendar ideas

### 10.1 Weekly rhythm (Instagram/TikTok)
- **Monday:** owner tip (how to price memberships, how to cut no-shows, how to collect fees).
- **Tuesday:** feature in 15 seconds (one feature per week, rotating through section 2).
- **Wednesday:** member-side fun (shake, drop joke, PR confetti, streaks).
- **Thursday:** gym spotlight / behind the scenes (once there are customers; with their permission).
- **Friday/Weekend:** a meme or trend for gym culture in Lebanon (light, no politics).

### 10.2 Blog / SEO article ideas
1. How to stop members not paying at your gym (without awkward conversations)
2. Dollars or lira? How to price gym memberships in Lebanon
3. Notebook vs Excel vs gym software: what Lebanese gyms really need
4. NFC check-in for gyms: how a $1 sticker replaces a turnstile
5. 7 ways to keep gym members from leaving after the first month
6. How to run class bookings and waitlists for your studio
7. Why your trainers should send programs through an app (not PDFs on WhatsApp)
8. How to start a gym in Lebanon: a checklist `[legal and licence details must be checked by the founder]`
9. Monthly courses (Pilates, Zumba, boxing): how to sell and track them
10. What every gym owner should check on their dashboard every morning

### 10.3 Seasonal moments in Lebanon
- **January:** New Year resolutions (the biggest sign-up month for gyms). Push hard in December.
- **Spring / pre-summer (March to June):** "summer body" season, beach season in Lebanon.
- **Ramadan:** gyms change hours and members' training shifts to the evening; content about schedules and late
  classes. Be respectful.
- **Back to school / September:** routines restart.
- **Summer:** many people travel or the diaspora visits. A good moment for "members pause themselves" content.
- **Black Friday / end of year:** `[TO CONFIRM any offer with the founder]`.

---

## 11. Instructions for the AI marketing assistant

1. **Facts come only from this file.** If it's not here, mark `[TO CONFIRM]`.
2. **Never invent** testimonials, customer names, logos, numbers of gyms, statistics, partnerships, awards, press
   mentions or discounts.
3. **Always include a clear call to action:** try the live demo at `[WEBSITE]/demo` (best for cold audiences and
   ads), start the free trial at `[WEBSITE]/signup`, or WhatsApp `[WHATSAPP_SALES]`.
4. **Lead with money and time** for owners (pillars 1 and 2), **fun and progress** for members (pillar 3).
5. **Respect the guardrails in section 3,** especially: no Arabic-interface claim, no App Store, no AI features,
   no turnstile integrations, no card payments online.
6. **Write locally.** Lebanese references, Lebanese names, dollars and lira, WhatsApp. When writing in dialect,
   flag it for a native speaker to check.
7. **Keep it short.** Headlines under 8 words. Social captions under 150 words. One idea per post.
8. **No politics, religion, sects or crisis jokes.**
9. **Respect privacy and the law.** No messaging people who haven't agreed to it; no scraping personal numbers;
   follow Meta's and WhatsApp's business policies.
10. **When you give the founder a plan or content,** say which persona, pillar and channel it's for, and what to
    measure.
11. **When the price or offer changes,** the founder will update section 2.4. Always use the latest numbers in
    this file.
12. **Sound like Gymix (section 7.2):** smart first, funny second, Lebanese all the way. Truth, twist, fact, nudge.
    Tease situations, never people. If it could be any software company's post, rewrite it.

### Example prompts the founder can use with you
- "Write 10 Instagram captions for Reel 1 in Lebanese Arabizi and English."
- "Make a 2-week trial nurture sequence for WhatsApp for a CrossFit box owner."
- "Write a one-page sales sheet for women-only gyms."
- "Plan a 30-day launch campaign for gyms in Jounieh and Kaslik with a $300 ad budget."
- "Answer this objection from a gym owner: [paste message]."
- "Write the script for a 60-second demo video of the front desk using Gymix."
- "Write a blog article: How to stop members not paying at your gym."

---

## 12. Quick reference card

| | |
|---|---|
| **Product** | Gymix, the all-in-one gym system (staff dashboard + member app) |
| **For** | Gyms and studios in Lebanon |
| **Price** | $19.99/month per gym, unlimited members and staff, everything included |
| **Live demo** | `[WEBSITE]/demo`: a private sample gym with a guide, no sign-up, deleted after 24 hours |
| **Trial** | 14 days free, no card |
| **Pay Gymix by** | Whish, OMT, bank transfer |
| **Setup** | About 10 minutes |
| **Hardware** | NFC stickers (about $1 each) or QR, nothing else |
| **Member app** | Web app installed from a link, iPhone + Android, no store |
| **Currencies** | USD prices, lira payments at the gym's own rate |
| **Top 3 selling points** | Unpaid? Frozen. · Tap to check in · $19.99 for the whole gym |
| **Language of the app** | English (marketing can be in Arabic, Lebanese, French, English) |
| **Tagline** | Run your gym. Keep them coming back. |
| **Colours** | Lime `#C8F135`, Ink `#0D1117`, Canvas `#F4F5F2` |
| **CTA** | Try the demo: `[WEBSITE]/demo` · Start your free trial: `[WEBSITE]/signup` · WhatsApp `[WHATSAPP_SALES]` |
