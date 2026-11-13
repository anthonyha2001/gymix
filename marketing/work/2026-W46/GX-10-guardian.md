# GX-10 · Guardian check: the sales pack (2026-W46)

Checked line by line against `marketing/GYMIX_MARKETING_BRIEF.md` (sections 2, 3, 6.4, 7.2, 8.3, 9.3, 9.4, 9.7), the
GX-10 card in `plan.md`, and the product facts the coordinator checked in the code on 9 November (lira payment via
"Renew / sell" with "Cash (LBP)"; Tarek refused with "Membership expired on <date>"; refused tap = red screen, the
reason and "Please see the front desk."; until WhatsApp is connected, login links go out by hand from the member
profile with "Copy link" / "Copy full message"; demo deleted after 24 hours; no WhatsApp automation, shop or other
in-testing features in public; English-only interface).

## Summary

| # | Piece | Verdict | Reason |
|---|---|---|---|
| 1 | GX-1 · The 10 to start with | FIX | Heading says "5 visits per trip" (plan: 5 visits in 2 trips); 3 of Trip 1's 5 picks have only old sources. Swap order (below). |
| 2 | GX-1 · The 40 (leads.csv rows) | FIX | Hi Tec Fitness has no real source (a Maps search is not a source); 9 rows are outside the area list or have no confirmed area; 5 rows may be chains/franchises; Class Sport is labelled "backup" but sits in the 40. No personal numbers: pass. |
| 3 | GX-1 · "Later" list and backups | PASS | Chains kept out correctly. (3 backups have no link; add one before use.) |
| 4 | GX-5 · A4 one-pager (text + `GX-5-1.svg`) | FIX | Price line misses "for the whole gym" (reads like it could be per member); the "Get paid" line overflows its card in the SVG. No WhatsApp/receipt claims: pass. QR to `/demo`: pass. |
| 5 | GX-5 · Leave-behind card (`GX-5-2.svg`) | PASS | One line, QR to `[WEBSITE]/demo`, "No sign-up", `[WHATSAPP_SALES]`. Back-of-card line correctly held as `[TO CONFIRM]`. |
| 6 | GX-5 · Reel covers (`GX-5-3/4/5.svg`) | FIX | Over the 8-word on-image limit; internal labels "REEL 7" / "REEL 1" shown to the public; Abou Bkra cover has lime-on-lime pill, rule and logo tile (invisible); Ep. 1 subline "Bkra, he paid." gives away Ep. 3. |
| 7 | GX-5 · Print notes | PASS | No invented costs; "don't print until `[WEBSITE]` is filled and the QR tested" is right. |
| 8 | GX-6 · Campaign, budget, audiences, placements | FIX (small) | Correctly "not live", `[AD_BUDGET]` only as percentages, no click-to-WhatsApp, no benchmarks. Scaling rule must stay inside a budget the founder approves. |
| 9 | GX-6 · A1 Abou Bkra | PASS | Hook from the bank, dialect marked NEEDS NATIVE CHECK, facts exact, no emoji. Note on the red screen below. |
| 10 | GX-6 · A2 Run a gym for a day | PASS | Brief 9.6 live-demo ad, CTA Learn more → `[WEBSITE]/demo`. |
| 11 | GX-6 · A3 Price line | PASS | Exact 2.4 facts; "Khalas" marked. |
| 12 | GX-6 · A4 Demo straight facts | FIX | Headline "Try your gym system today." is bland (any software company). |
| 13 | GX-6 · A5 Studios | FIX | No hook (medium-playful ads need one clever line); carousel asks for waitlist and monthly-course screens the demo may not have `[TO CONFIRM]`. |
| 14 | GX-6 · Creative cuts, tracking, rules, checklist, ads.csv rows | FIX (small) | Add the WhatsApp message log/chat to the "remove from both" list; don't fake the refused screen. Rows: pass. |
| 15 | GX-7 · Send rules + channel order | FIX | Brief 9.4: cold WhatsApp only to people who agreed or reached out first. First touch goes by Instagram/Facebook DM; WhatsApp only after a reply, or where the gym's own page invites WhatsApp messages. |
| 16 | GX-7 · Visit plan (2 trips, times, route, bring list) | PASS | 5 gyms, off-peak times stated as reasoning not data, backups, sticker give-away held as `[TO CONFIRM]`. |
| 17 | GX-7 · 2-minute demo script | FIX | Step 4 `[TO CONFIRM]` now resolved by the verified clicks; step 3 should quote the real refusal; step 5 uses an unverified button label. |
| 18 | GX-7 · Pre-visit DM (EN + Arabizi) | PASS | Personal, light, no claims. Arabizi marked. |
| 19 | GX-7 · Message 1 Phocus | FIX (Arabizi only) | "b2arjik" is a typo for "farjik"; "Phocus gym 7ayy 7a2i2i" reads oddly. English: pass. |
| 20 | GX-7 · Message 2 Grizzly | PASS | One light line on the gym's name (teases the name, not a person), facts exact. |
| 21 | GX-7 · Message 3 Barefoot | FIX (Arabizi only) | Arabizi assumes a woman owner ("7ottellik", "Jarrbi"). English: pass. |
| 22 | GX-7 · Message 4 Namat | FIX (Arabizi only) | Same gender assumption ("Jarrbi", "farjik" is fine). English: pass. |
| 23 | GX-7 · Message 5 Body Garage | FIX | "has sold monthly and 3-month memberships" comes from an old deals guide; quoting an old deal to the owner reads stale. Only say it if a current post shows it. |
| 24 | GX-7 · Messages 6-10 (BASE, Samer, M-J-J, Fitness Town, Fitnessaddict) | PASS | Personal, one detail each, facts exact, CTA `[WEBSITE]/demo`, all Arabizi marked. (Fitness Town: only use "6 am to 9 pm" if their own page still says so.) |
| 25 | GX-7 · Superhero Gym email | FIX (small) | "to non-guests" is inferred, not in the source. |
| 26 | GX-7 · Day 2 follow-up | PASS | Uses the verified Tarek refusal. Arabizi "ftesh" → native check ("fattesh"). |
| 27 | GX-7 · Day 6 follow-up | PASS | "Chasing is Gymix's job" is on-voice; no pressure; no discount. |
| 28 | GX-7 · Post-visit message (EN + Arabizi) | PASS | WhatsApp login-links line removed as asked. Optional verified line offered below. |
| 29 | GX-7 · Objection replies | FIX | "Won't download an app" now has a verified answer (Copy link); Arabic, multi-branch and turnstile answers are honest: pass. |
| 30 | GX-7 · leads.csv tracking lines | PASS | |

**Totals: 14 PASS, 16 FIX** (6 of the FIXes are small: one line or the Arabizi only).

---

## GX-1 · Lead list

**Privacy: PASS.** The only `public_contact` (Superhero Gym, `+961 70 034 588` and `superherogym@thesmallville.com`)
is published by the business itself on the hotel's own gym page. Note: a 70 number is a mobile line; treat it as a
**call or email** contact, not a cold WhatsApp (brief 9.4). The "take the number from the gym's own page, not the
directory" rule (Samer, CrossFit BPC) is right. The old competitor-gym prices in the notes ($85, $130) are internal
only: never quote them in a message or post.

### Fix 1: the "10 to start with" heading and Trip 1 order
Replace the heading line:
> ## The 10 to start with (2 trips, about 5 visits in total, the rest are backups or first messages)

Trip 1: Phocus (reviews 2017-2019 only), Grizzly (FB may be old) and Body Garage (old guide) are all uncertain.
Keep them, but put **Kurv Studio** (Achrafieh, Adib Ishac St, own Instagram @kurvstudio.lb, recently opened) in the
Trip 1 backup list next to Namat, so a dead morning still gives the founder a live studio to walk into. Add this
line under the Trip 1 table:
> Backup with an active Instagram: **Kurv Studio**, Adib Ishac St, Achrafieh (@kurvstudio.lb). Persona B.

### Fix 2: Hi Tec Fitness Achrafieh has no source
The `source` cell is a Google Maps search, the same as the `maps` cell. That is not a source. Corrected row:

| gym | area | type | size | instagram | maps | public_contact | source | stage | next_step | date | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hi Tec Fitness Achrafieh | Achrafieh | gym | ~200-500 (guess) |  | https://www.google.com/maps/search/Hi+Tec+Fitness+Achrafieh |  | [TO CONFIRM: no source found; add the gym's own Instagram/FB link or drop the row] | new | find a real source; check for other branches ("Achrafieh" in the name suggests there may be more) before any contact | 2026-11-09 | Directory showed 4.9 stars from 32 reviews. Unsourced (?) |

### Fix 3: rows outside the area list or with no confirmed area
The card says Beirut and Metn only, from the 4.2 list. These rows stay in the sheet but **must not be contacted**
until the founder says yes (`next_step` replaced):

| gym | why | `next_step` |
|---|---|---|
| Class Sport Gym and Spa (Mansourieh) | outside the list, and GX-1 itself calls it "backup only" | move to the Backups list; refill the 40th row with Beyond Submissions Lebanon once its area is confirmed inside Beirut/Metn, or run with 39 |
| INRI CrossFit (Beit Meri) | Metn, not on the list | hold: founder to confirm area |
| BARR (Gemmayzeh) | Beirut, not on the list | hold: founder to confirm area |
| PowerBox Gym (Furn El Hayek) | Beirut edge, not on the list | hold: founder to confirm area |
| Cratus, Body Line, Tiger Zone, Dunamis, Haifa S Fitness | area not captured | hold: confirm area first; drop if outside Beirut/Metn |

### Fix 4: possible chains or franchises inside the 40
Add "**check single site before any contact**" to `next_step` for: **The V Club** (larger club), **Oxygen Gym & Spa**,
**10th Planet Beirut** (international brand: a franchise is a chain for our purposes), **CrossFit 961** (it sits
inside Champs Fitness Center: the decision maker may be Champs), **Vim & Vigor**, **Hi Tec Fitness**. If any has
several branches, move it to the "Later" list (brief 3: no multi-branch view).

---

## GX-5 · Visit kit

### Fix 5: A4 one-pager
**Price line** (header, `GX-5-1.svg` text at y=340, and the "Exact text" list):
> $29.99 a month for the whole gym. 14 days free.

(Brief 1 and 2.4: per gym, not per member. Owners read "$29.99" as per member unless told.)

**"Get paid" line overflows.** At 17 px the 90-character line is about 790 px wide; the card leaves about 630 px.
Split it into two lines. Replace the single `<text x="106" y="473" ...>` in `GX-5-1.svg` with:
```svg
<text x="106" y="469" font-family="Geist, Inter, Arial, sans-serif" font-size="17" font-weight="500" fill="#5d6470">Unpaid members freeze automatically. See who owes what.</text>
<text x="106" y="491" font-family="Geist, Inter, Arial, sans-serif" font-size="17" font-weight="500" fill="#5d6470">Dollars and lira at your own rate.</text>
```
In Canva: let the body text box wrap to two lines inside the 28 mm row.

Canva step 7 (optional screenshot): add "never the shop page, **never the WhatsApp message log or a chat showing
automatic messages**".

Everything else on the one-pager passes: no WhatsApp reminders or receipts, no invented numbers, QR to
`[WEBSITE]/demo` only, all three CTAs as placeholders.

### Fix 6: Reel covers (one series template, 8 words max on the image, everything included)
The current covers carry 15-18 words (pill + headline + subline + footer), and the pills "REEL 7" / "REEL 1" are our
internal numbers: a stranger scrolling the grid would wonder where Reels 2 to 6 went. Corrected text:

| Cover | Pill | Headline (2 lines) | Subline | Words |
|---|---|---|---|---|
| Reel 7 | NO SIGN-UP | Run a gym / for a day. | (none) | 8 |
| Reel 1 | GET PAID | Unpaid? / Frozen. | Right at the door. | 8 |
| Abou Bkra Ep. 1 | ABOU BKRA 1 | Pay tomorrow? / Enter tomorrow. | (none) | 7 |
| Abou Bkra Ep. 2 | ABOU BKRA 2 | The freeze / knows no one. | (none) | 8 |
| Abou Bkra Ep. 3 | ABOU BKRA 3 | Welcome back, / habibi. | (none) | 6 |

- Remove the footer "GYMIX / LIVE DEMO, NO SIGN-UP" from all covers (the logo is enough; the caption carries the CTA).
- "Pay tomorrow? Enter tomorrow." is the brief's own English for "Bkra bedfa3? Tayyeb. W bkra btfout." and matches
  Ep. 1, where he is refused. The old subline "Bkra, he paid." gave away Ep. 3. If an Arabizi version is used on the
  image, it is **NEEDS NATIVE CHECK**. "habibi" on Ep. 3: **NEEDS NATIVE CHECK** (low risk, keep on the list).
- Abou Bkra headline size: set **both lines at 100 px** on all three episodes so the set matches and
  "Enter tomorrow." / "knows no one." stay inside the 80 px side margins. Check widths in Canva.
- Reel 7 pill: widen the pill to about 270 px for "NO SIGN-UP".

**`GX-5-5.svg` (lime background) contrast fixes:**
- Pill: `fill="#0d1117"` and pill text `fill="#c8f135"` (it is lime on lime today, invisible).
- Bottom rule: `fill="#0d1117"` (lime on lime today). Or drop the rule with the footer.
- Logo tile: the lime square disappears on lime. Add an ink outline to the tile:
  `<rect width="100" height="100" rx="22" fill="#c8f135" stroke="#0d1117" stroke-width="4"/>`, or place the logo on
  a small ink rounded tile. `[TO CONFIRM with founder: is an ink-outlined logo tile OK on lime backgrounds?]`

Image prompt (optional photo): use a **real photo the founder takes** at a gym door (brief 7.1: real Lebanese gyms,
not stock or generated). If an AI image is used, it must never be presented as a real Gymix gym.

---

## GX-6 · Meta ads plan

Passes the card's hard checks: clearly "not live this week", budget only as percentages of `[AD_BUDGET]`, no
invented costs or benchmarks, no click-to-WhatsApp, no WhatsApp reminders, no emojis, dialect marked.

### Fix 7: scaling rule (section 5, day 14)
Replace the first day-14 bullet with:
> - **Scale** only an ad that produced demos started **and** at least one trial started, and only inside a budget the
>   founder has approved in writing. Raise it gradually rather than doubling; the founder decides each step.

### Fix 8: A4 headline
Current: "Try your gym system today." (bland). Corrected:
> **Headline:** Done before your coffee cools.

(5 words; it pays off the primary text's "All before your coffee gets cold", from the hook bank.) Rest of A4 passes.
The static screenshot is the real refusal ("Membership expired on <date>"); hide the address bar.

### Fix 9: A5 studios
Corrected primary text (adds the hook, same facts as brief 9.6):
> Your class bookings live in your DMs. They deserve better. Gymix puts bookings, waitlists and monthly courses in
> one calendar, plus an app your members open from a link, no store. Built for studios in Lebanon. See it on a
> sample gym, no sign-up. 14 days free when you start.

Headline stays "Your studio, running itself." Creative: `[TO CONFIRM: does the demo gym have a waitlist and a monthly
course to screenshot? The brief lists weekly classes with bookings.]` If not, use only the class calendar with
bookings and Karim's app, and drop "waitlist" / "monthly course" from the carousel cards (the text can keep them:
they are live features, brief 2.2).

### Fix 10: creative cuts (section 3)
Replace the "Remove from both" bullet with:
> - **Remove from both:** the shop page, any "in testing" screen, **the WhatsApp message log and any chat showing
>   automatic WhatsApp messages**. Hide the browser address bar and blur any real URL, email or number.

Add under Abou Bkra Ep. 1:
> - The red screen is the real one: the reason and "Please see the front desk." A burned-in caption ("Unpaid?
>   Frozen.") is fine; **don't mock up a fake app screen** with words the app doesn't show (brief 3: no fake
>   screenshots).

A1, A2, A3 pass as written. `ads.csv` rows pass.

---

## GX-7 · Outreach

### Fix 11: channel order (top of section 2) and send rules
Replace the "Channel order" paragraph with:
> Channel order: the gym's **Instagram business DM** if you found one; else its **Facebook page** message. **WhatsApp
> only after they reply or agree**, or where the gym's own page invites WhatsApp messages ("WhatsApp us" with a
> business number). Never a number from a directory, never a personal number. Under 80 words each. `[DETAIL]` = one
> real thing from their latest post (optional, delete if none).

(Brief 9.4 header and 8.3 B: no unsolicited WhatsApp messages to numbers that didn't agree.)

### Fix 12: the 2-minute demo script, steps 3 to 5
> 3. **Tarek refused (25s).** At **Check-in**, search **"Tarek Mansour"** and check him in. Gymix refuses him:
>    "Membership expired on [date]". "Same lock for anyone who still owes a set number of days after the invoice,
>    3 by default, you choose. Unpaid? Frozen. The next check-in after he pays unfreezes it. No speech at the door.
>    At the door sticker, he'd get a red screen that says why and 'Please see the front desk.'"
> 4. **Dollars and lira (25s).** Open a member's profile, tap **"Renew / sell"** (or record a payment) and choose
>    **"Cash (LBP)"**: the amount shows in lira at the gym's own rate. "Prices in dollars, take lira at your rate,
>    change the rate whenever you want. Cash, card, Whish or OMT."
> 5. **Member app (20s).** Switch to the member's phone (Karim's app) `[TO CONFIRM: exact label of the switch
>    button]`: today's workout, membership and days left, classes. "Your members open a link, no App Store. They can
>    add it to the home screen." Switch back.

(Delete the old step-4 `[TO CONFIRM]`; it is answered.)

### Fix 13: Arabizi corrections (all still NEEDS NATIVE CHECK)
- **Message 1 (Phocus):** "Phocus gym 7ayy 7a2i2i bi Sioufi" → "Phocus gym el 7ayy bi Sioufi"; "Aw b2arjik bi 2
  minutes hal jem3a?" → "Aw farjik bi 2 minutes hal jem3a?"
- **Message 3 (Barefoot):** the owner's gender is unknown. "Gymix bi 7ottellik yehon" → "Gymix bi 7ottelkon yehon";
  "Jarrbi:" → "Jarrbo:".
- **Message 4 (Namat):** "Jarrbi:" → "Jarrbo:"; "Fiyye farjik" → "Fiyye farjikon".
- **Day 2:** "ftesh" → "fattesh".

### Fix 14: Message 5 (Body Garage), English
> Hi! [FOUNDER_NAME] from Gymix. Body Garage sells monthly and longer memberships [DETAIL]. Gymix tracks every
> expiry for you, and when someone hasn't paid, they're frozen at the door automatically. Dollars or lira at your
> rate. $29.99 a month for the whole gym, 14 days free, no card. Try a sample gym, no sign-up: [WEBSITE]/demo. Or
> 2 minutes at the gym this week?

Use the first sentence only if a **current** post shows memberships; otherwise delete it and start at "Gymix tracks".
Arabizi: same change ("Shefet Body Garage bibi3 eshtirakat chahr w 3 cheher" → "Body Garage bibi3 eshtirakat
chahriyye w atwal"), NEEDS NATIVE CHECK.

### Fix 15: Superhero Gym email, first line
> Hi, this is [FOUNDER_NAME] from Gymix. I saw Superhero Gym sells gym memberships alongside the hotel.

(Rest passes. The source lists a gym-only membership; "to non-guests" was an inference.)

### Fix 16: objection "My members won't download an app"
> "They don't download anything. You send each member their link: in Gymix you open their profile, tap 'Copy link'
> or 'Copy full message', and send it to them yourself. One tap and they're in, and they can add it to the home
> screen. No App Store, no password."

(Remove the `[TO CONFIRM]` on this row; it's answered. Don't say Gymix sends it on WhatsApp.) The Arabic, multi-branch
and turnstile answers pass as written.

### Optional (post-visit message, passes without it)
Add as the third bullet, now that the manual route is verified:
> - Then send each member their login link from their profile in Gymix ("Copy link"), one by one.

---

## What the founder can print, send and save as-is today

**Save today (no placeholders block them):**
- GX-1's 40 rows into `marketing/board/leads.csv`, with Fixes 2-4 applied (Hi Tec unsourced, 9 rows on hold, 6 rows
  "check single site").
- GX-7's tracking lines (section 5) into `leads.csv`.
- GX-6's five `ads.csv` rows (spend and results blank).

**Send today:** only the **English pre-visit DM** (it has no `[WEBSITE]`), once `[FOUNDER_NAME]` is filled and the
gym passes the 2-minute open check, to the gym's own business account, one by one. The Arabizi version waits for the
native check.

**Send once `[WEBSITE]` and `[FOUNDER_NAME]` are filled:** first messages 2, 6, 7, 8, 9, 10 (English) as written;
1, 3, 4, 5 with Fixes 13-14; the Superhero email with Fix 15; the day-2 and day-6 follow-ups; the post-visit message.
Every Arabizi version only after a Lebanese speaker reads it. Always under the GX-7 "Send only if" rules and Fix 11.

**Print once `[WEBSITE]` is filled and the QR is tested on a phone:** the leave-behind card (`GX-5-2.svg`) as is
(`[WHATSAPP_SALES]` filled too, or removed from the card); the one-pager after Fix 5.

**Not yet:** Reel covers until Fix 6 is applied; ads stay a plan (go-live checklist, `[AD_BUDGET]`, Fixes 7-10).

---

## Handoff
For: the main session (update the board), then the founder (fill placeholders, native check, open checks, print)
Persona / pillar / channel: A, B, C / 1 Get paid, 2 Save time, 4 Built for Lebanon, 5 Fair price / visits, Instagram and Facebook DM, email, print, Meta ads (plan)
What to measure: trials started from the 5 visits and the messages actually sent
Open questions:
- [WEBSITE], [WHATSAPP_SALES], [FOUNDER_NAME], [AD_BUDGET] unfilled
- [TO CONFIRM] Hi Tec Fitness: a real source, or drop it
- [TO CONFIRM] Founder: count Mansourieh, Beit Meri, Gemmayzeh, Furn El Hayek as in the area? Areas of Cratus, Body Line, Tiger Zone, Dunamis, Haifa S Fitness
- [TO CONFIRM] Single site: The V Club, Oxygen, 10th Planet, CrossFit 961 / Champs, Vim & Vigor, Hi Tec Fitness
- [TO CONFIRM] Ink-outlined logo tile on lime backgrounds
- [TO CONFIRM] Demo: a waitlist and a monthly course to screenshot for A5
- [TO CONFIRM] Exact label of the "switch to the member's phone" button in the demo
- [TO CONFIRM] Free NFC stickers at visits, and what the sample sticker opens (from GX-5/GX-7)
- [TO CONFIRM] Is Arabic planned for the app (objection reply)
- NEEDS NATIVE CHECK: every Arabizi line in GX-7, A1 and "Khalas" in GX-6, any Arabizi or "habibi" on covers
