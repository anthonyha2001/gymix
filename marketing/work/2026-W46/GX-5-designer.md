# GX-5 · Visit kit: one-pager, demo QR card, Reel covers (designer)

Sources: brief 7.1, 9.1, 9.3, 3, 7.2. SVG drafts at real size sit next to this file. Fonts in SVG fall back to Arial if Geist isn't installed; in Canva use Geist or the closest bold sans.

Brand tokens: Lime #C8F135 · Ink #0D1117 · Canvas #F4F5F2 · White #FFFFFF · Line #E2E4DE · Muted #5D6470 · Dark lime #A9D10F.
Logo: the exact `icon.svg` paths (lime rounded square, ink "G", two tap waves) plus the word "Gymix" in bold.

---

## 1. A4 one-pager (`GX-5-1.svg`, 210x297 mm, drawn 794x1123)

**Layout.** Ink header block (top 32%), then four white rounded rows on a Canvas background, then an ink CTA band at the bottom with the QR on the left. 56 px margins, one idea per row, lots of space. No photos in v1 (the brief prefers real app screenshots; optional, see Canva step 7).

**Exact text**
- Logo + "Gymix" (top left)
- Title: **Your gym,** / **running itself.** (second line in lime)
- Sub: The all-in-one gym system built for Lebanon.
- Price line: $19.99 a month. 14 days free.
- Row 1 **Get paid:** Unpaid members freeze automatically. See who owes what. Dollars and lira at your own rate.
  (Per the plan, "WhatsApp renewal reminders" and "receipts" are removed.)
- Row 2 **Tap to check in:** A $1 sticker at the door. No hardware.
- Row 3 **A member app:** Programs, classes and progress. No store download.
- Row 4 **Your whole team:** Owner, manager, front desk and trainers, each with their own access.
- CTA band: **Run a gym for a day.**
  - Try the live demo: `[WEBSITE]/demo`
  - Start free: `[WEBSITE]/signup`
  - WhatsApp: `[WHATSAPP_SALES]`
  - No sign-up for the demo. No card for the trial.
- QR: 40 mm square, white, bottom-left of the band, placeholder labelled "QR -> [WEBSITE]/demo". Keep 4 mm quiet zone. The QR goes to `/demo` only (cold audience).

**Canva build steps**
1. New design, A4 portrait (210x297 mm). Background Canvas #F4F5F2.
2. Rectangle full width x 95 mm, Ink #0D1117, at the top.
3. Upload `web/src/app/icon.svg` as the logo (15 mm). Next to it "Gymix", Geist Bold 26 pt, white.
4. Title in Geist ExtraBold 44 pt: line 1 white, line 2 lime. Sub 15 pt Line grey, price line 15 pt white bold.
5. Four rounded rectangles (white, 1 px #E2E4DE border, radius 5 mm), 28 mm tall, 32 mm gap rhythm. A 3 mm lime bar at the left of each. Heading Geist ExtraBold 18 pt Ink, body 12 pt Muted.
6. CTA band: Ink rounded rectangle, 180 x 53 mm. Generate the QR in Canva (Apps > QR Code) for `[WEBSITE]/demo` once the founder fills it, on a white tile. Text beside it as above, headline lime 21 pt.
7. Optional: replace nothing with a mockup; if a screenshot is wanted, use a real screenshot of the live demo (sample data, never the shop page) at 60 mm wide in the header's right side.
8. Export PDF Print, CMYK if the printer asks; add 3 mm bleed on the header block.

---

## 2. Leave-behind card (`GX-5-2.svg`, A6 105x148 mm portrait, drawn 397x559)

Goes with a free NFC sticker. Ink background, lime accent, one line, one QR.

**Exact text**
- Logo + "Gymix"
- **Run a gym** / **for a day.** (second line lime)
- QR tile, 53 mm, placeholder "QR -> [WEBSITE]/demo"
- **No sign-up**
- WhatsApp `[WHATSAPP_SALES]`

**Back of the card (optional, blank is fine):** "Tap the sticker. Then try the demo." Keep to 8 words max. Do not promise what the sticker does until confirmed with the founder: `[TO CONFIRM: what does the sample NFC sticker open when tapped? ideally the demo link]`.

**If printed as a business card (85x55 mm):** landscape, same elements, QR 30 mm on the right, text left. Build in Canva by resizing the A6 design.

**Canva steps:** A6 portrait, Ink background, logo top left, headline Geist ExtraBold 30 pt, QR tile white with 4 mm quiet zone, text centred below.

---

## 3. Reel covers 1080x1920 (`GX-5-3.svg` Reel 7, `GX-5-4.svg` Reel 1, `GX-5-5.svg` Abou Bkra Ep. 1)

**One series template.** Logo + "Gymix" top-left (inside the top safe zone, below 150 px), a lime pill tag with the series/episode label at y 620, a two-line headline at 150 px ExtraBold (line 2 in the accent colour), one subline at 48 px, a lime rule near the bottom, and the footer "GYMIX / LIVE DEMO, NO SIGN-UP". Keep everything out of the bottom 380 px and top 150 px (Instagram UI and the profile grid crop). Ink background for product Reels (7 and 1); **lime background with ink text for the Abou Bkra series**, so Ep. 1, 2 and 3 look like a set: only the pill ("EP. 1", "EP. 2", "EP. 3") and the headline change.

| Cover | Pill | Headline | Subline | Background |
|---|---|---|---|---|
| Reel 7 | REEL 7 | Run a gym / for a day. | Try the sample gym. No sign-up. | Ink |
| Reel 1 | REEL 1 | Unpaid? / Frozen. | Automatically. No awkward chat. | Ink |
| Abou Bkra Ep. 1 | ABOU BKRA  EP. 1 | Abou Bkra / meets freeze. | Bkra, he paid. | Lime |

All within 8 words, no emojis, no faces, no numbers. Ep. 2 "Wasta" suggestion (same template): headline "The freeze / knows no one." NEEDS NATIVE CHECK for any Arabizi version ("El freeze ma bya3ref wasta" is the brief's line, NEEDS NATIVE CHECK before use on image). Ep. 3 "Redemption": headline text is for the copywriter/GX-3 to confirm `[TO CONFIRM]`.

**Optional background imagery:** none needed. If a photo is wanted, image prompt: "Phone tapping an NFC sticker beside a gym door, shallow depth of field, warm natural light, no faces visible, no brand logos, Lebanese gym interior, lots of empty space at the top" (lime accent added in Canva).

**Canva steps:** 1080x1920 design, set a 150 px top and 380 px bottom guide. Build Reel 7 first, then duplicate for Reel 1; duplicate again, change the background to lime and the text to ink for Abou Bkra. Save the Abou Bkra page as a template and reuse for Ep. 2 and 3. Export PNG; upload as the Reel cover (check it crops well in the 4:5 profile grid: the headline is centred enough in the SVG only vertically, so check on the phone and nudge it).

---

## 4. Print notes

- **Quantities, week 1:** 20 one-pagers, 30 cards (suggested in the plan; the card pairs with a free NFC sticker, so order 30 stickers to match, `[TO CONFIRM: sticker supplier and unit cost]`).
- **Paper:** one-pager 150 gsm matt or silk, printed one side. Cards 300-350 gsm matt, no lamination needed (laminate only if a cheap option is quoted). Print one-pagers on a regular digital press so they can be reprinted in small batches.
- **Printer:** `[TO CONFIRM: printer in Beirut/Metn]`. Ask for a digital print quote for 20 x A4 + 30 x A6, for a proof first. Do not print until `[WEBSITE]` and `[WHATSAPP_SALES]` are filled and the QR is tested on a phone.
- **Cheaper fallback:** print the one-pager at a copy shop on regular paper first and hand-deliver; or skip the one-pager and leave only the card.
- Costs: none stated here, none invented.

## Guardrail check
No WhatsApp reminders/receipts claim, no door access, shop, screens, occupancy, kiosk, no AI, no customer counts, no invented numbers or testimonials, no competitor names. "$1 sticker" and "$19.99 a month, 14 days free" are from brief 9.1/9.3. "See who owes what" is per the task card.

## Handoff
For: gymix-guardian (check), then the founder (fills placeholders, orders print, builds in Canva)
Persona / pillar / channel: A, B / 1 Get paid, 2 Save time, 5 Fair price / print (visits), Instagram covers
What to measure: demos started (QR scans to `/demo` after visits; use a UTM on the QR link)
Open questions:
- `[WEBSITE]` and `[WHATSAPP_SALES]` placeholders to fill
- `[TO CONFIRM: printer in Beirut/Metn]`
- `[TO CONFIRM: sticker supplier and unit cost]`
- `[TO CONFIRM: what the sample NFC sticker opens when tapped]`
- `[TO CONFIRM: Ep. 3 cover headline]`
- Any Arabizi on image: NEEDS NATIVE CHECK
