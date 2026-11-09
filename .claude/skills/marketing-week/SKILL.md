---
name: marketing-week
description: Run a week of Gymix marketing with the AI team (the gymix-* agents). Use when the founder says "run the marketing week", "start the marketing", "plan this week's marketing", or invokes /marketing-week. Optional argument - a focus or notes for the week (e.g. "focus on Jounieh gyms").
---

# Run the Gymix marketing week

You are the coordinator. The team is the 13 `gymix-*` subagents in `.claude/agents/`. How the team works is in
`marketing/AI_MARKETING_TEAM.md`; the facts are in `marketing/GYMIX_MARKETING_BRIEF.md`; the memory is
`marketing/board/`. The founder approves, publishes, pays and sends: nothing leaves this machine without them.

## 1. Set up the week
- Work out the ISO week (e.g. `2026-W46`) and create `marketing/work/<week>/`.
- Read the board (`marketing/board/*.csv`, `questions.md`), last week's folder (if any), and the founder's notes
  (the skill argument, or ask in one line if there are none and it's not week 1).

## 2. Plan (CMO)
Run `gymix-cmo` with: the week, the founder's notes, and the paths above. It writes
`marketing/work/<week>/plan.md` with priorities and task cards (`### GX-<n>`, each with Owner, Depends on, Output).
Show the founder the 3 priorities and the list of cards in a few lines. Unless they asked to plan only, carry on.

## 3. Produce (specialists, in waves)
- Wave 1: every card with `Depends on: none`, run **in parallel** (one Agent call each, in a single message), each
  agent given its full task card text, the week, and its output path.
- Wave 2+: cards whose dependencies are done, passing the earlier output paths in the task.
- Cards for `gymix-guardian` come last in their chain: give it every draft path it must check.
- If a card is for a human (visits, recording, posting), don't run an agent: list it for the founder.
- Cost care: a normal week is 6-12 agent runs. If the plan has more than 15 cards, ask the founder which to run.

## 4. Check
Every public-facing piece must have a Guardian **PASS** (or a FIX with the corrected version applied) before it's
shown as ready. If the Guardian says FIX, either use its corrected version or send the card back to its author once
with the Guardian's notes, then re-check.

## 5. Update the board
From the outputs, add or update rows: `tasks.csv` (status: approved-by-guardian / founder), `calendar.csv` (posts),
`leads.csv` (new leads, stage "new"), `ads.csv` (planned campaigns), `metrics.csv` (from the Analyst), and add every
`[TO CONFIRM]` to `questions.md` (don't duplicate). Keep CSVs valid: quote fields that contain commas or quotes.

## 6. Hand over to the founder
Write `marketing/work/<week>/README.md`: what's ready (with file links), what the founder does this week (in order,
with time estimates), and the open questions. Then tell the founder in chat, briefly:
- what's ready to post or send (links),
- their to-do list for the week,
- questions only they can answer.
Never post, publish, message anyone or spend money yourself.

## Friday (when the founder brings numbers)
Run `gymix-analyst` with the pasted numbers and the board; add its metrics row; the report feeds next week's CMO.
