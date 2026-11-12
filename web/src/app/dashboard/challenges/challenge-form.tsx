"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { ChoiceChips } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { METRICS, type Metric } from "@/lib/challenges";
import { ChallengeCardFace } from "@/components/challenge-card";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type ChallengeValues = {
  title: string;
  metric: Metric;
  starts_on: string;
  ends_on: string;
  target: number | null;
  prize: string | null;
  description: string | null;
};

const monthName = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

function monthRange(today: string, offset: number) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: offset === 0 ? today : iso(first), end: iso(last) };
}

const SUGGESTED: Record<Metric, (month: string) => string> = {
  visits: (m) => `${m} visits challenge`,
  workouts: (m) => `${m} workout streak`,
  volume: (m) => `${m} heavy lifters`,
  classes: (m) => `${m} class marathon`,
};

// Posting a challenge: what it counts, which month, an optional goal and
// prize. The card on the right is what members swipe.
export function ChallengeForm({ action, today, initial, submitLabel }: { action: Action; today: string; initial?: ChallengeValues; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const thisMonth = monthRange(today, 0);
  const nextMonth = monthRange(today, 1);
  const [metric, setMetric] = useState<Metric>(initial?.metric ?? "visits");
  const [range, setRange] = useState({ start: initial?.starts_on ?? thisMonth.start, end: initial?.ends_on ?? thisMonth.end });
  const [title, setTitle] = useState(initial?.title ?? SUGGESTED.visits(monthName(thisMonth.end)));
  const [titleTouched, setTitleTouched] = useState(Boolean(initial));
  const [target, setTarget] = useState(initial?.target ? String(initial.target) : "");
  const [prize, setPrize] = useState(initial?.prize ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const suggest = (m: Metric, end: string) => {
    if (!titleTouched) setTitle(SUGGESTED[m](monthName(end)));
  };
  const preset = range.start === thisMonth.start && range.end === thisMonth.end ? "this" : range.start === nextMonth.start && range.end === nextMonth.end ? "next" : "custom";

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-[1fr_17rem]">
      <div className="space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Field label="What counts" group>
          <ChoiceChips
            name="metric"
            label="What counts"
            columns={2}
            value={metric}
            onChange={(v) => {
              setMetric(v as Metric);
              suggest(v as Metric, range.end);
            }}
            options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: `${METRICS[k].emoji} ${METRICS[k].label}`, hint: METRICS[k].hint }))}
          />
        </Field>
        <Field label="When" group>
          <ChoiceChips
            name="_when"
            label="When"
            value={preset}
            onChange={(v) => {
              if (v === "this") setRange(thisMonth);
              if (v === "next") setRange(nextMonth);
              if (v !== "custom") suggest(metric, v === "this" ? thisMonth.end : nextMonth.end);
            }}
            options={[
              { value: "this", label: `Rest of ${monthName(thisMonth.end)}` },
              { value: "next", label: `All of ${monthName(nextMonth.end)}` },
              { value: "custom", label: "Other dates" },
            ]}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" name="starts_on" aria-label="Starts" required value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className={inputClass} />
            <input type="date" name="ends_on" aria-label="Ends" required value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className={inputClass} />
          </div>
        </Field>
        <Field label="Name">
          <input
            name="title"
            required
            maxLength={60}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Goal (${METRICS[metric].units}, optional)`}>
            <input name="target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={metric === "volume" ? "50000" : "12"} className={inputClass} />
          </Field>
          <Field label="Prize (optional)">
            <input name="prize" maxLength={120} value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Free month for the winner" className={inputClass} />
          </Field>
        </div>
        <Field label="Message to members (optional)">
          <textarea name="description" maxLength={300} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Everyone who reaches the goal gets a free shake." className={inputClass} />
        </Field>
        <div className="flex justify-end">
          <Button disabled={pending}>{pending ? "Posting…" : submitLabel}</Button>
        </div>
      </div>
      <div className="hidden md:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Members see</p>
        <ChallengeCardFace
          preview
          challenge={{
            title: title || "Your challenge",
            metric,
            description: description || null,
            prize: prize || null,
            target: target ? Number(target) : null,
            starts_on: range.start,
            ends_on: range.end,
            state: range.start > today ? "upcoming" : "active",
            days_left: Math.max(0, Math.round((Date.parse(range.end) - Date.parse(today)) / 86_400_000) + 1),
            participants: 0,
          }}
        />
      </div>
    </form>
  );
}
