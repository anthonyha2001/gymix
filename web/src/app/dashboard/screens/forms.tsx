"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { ChoiceChips, Stepper } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { SLIDE_KINDS } from "./kinds";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;


export type SlideValues = {
  kind: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  theme: string;
  duration_seconds: number;
  starts_on: string | null;
  ends_on: string | null;
  weekdays: number[] | null;
  time_from: string | null;
  time_to: string | null;
  screen_ids: string[] | null;
};

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

export function SlideForm({ action, screens, initial, submitLabel }: { action: Action; screens: { id: string; name: string }[]; initial?: SlideValues; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [kind, setKind] = useState(initial?.kind ?? "announcement");
  const [theme, setTheme] = useState(initial?.theme ?? "dark");
  const [duration, setDuration] = useState(initial?.duration_seconds ?? 12);
  const [days, setDays] = useState<Set<number>>(new Set(initial?.weekdays ?? []));
  const [allScreens, setAllScreens] = useState(!initial?.screen_ids);
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.screen_ids ?? []));
  const [when, setWhen] = useState(Boolean(initial?.starts_on || initial?.ends_on || initial?.weekdays?.length || initial?.time_from));
  const custom = kind === "announcement" || kind === "promo";
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Shows" group hint={SLIDE_KINDS.find((k) => k.value === kind)?.hint}>
        <ChoiceChips name="kind" label="Shows" value={kind} onChange={setKind} columns={3} options={SLIDE_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      </Field>

      <Field label={custom ? "Headline" : "Heading"} optional={!custom}>
        <input name="title" maxLength={80} required={custom} defaultValue={initial?.title ?? ""} placeholder={custom ? "e.g. Ramadan hours: 7pm to 2am" : "Leave empty for the usual heading"} className={inputClass} />
      </Field>
      {(custom || kind === "occupancy") && (
        <Field label="Text" optional>
          <textarea name="body" maxLength={300} rows={2} defaultValue={initial?.body ?? ""} placeholder={kind === "promo" ? "e.g. 20% off all protein this week" : "A line or two"} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      )}
      {custom && (
        <>
          <Field label="Photo" optional hint="JPG, PNG or WebP, up to 5 MB. Shown beside the text.">
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:font-medium" />
          </Field>
          {initial?.image_url && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="remove_image" className="size-4 accent-ink" /> Remove the current photo
            </label>
          )}
          <Field label="Colours" group>
            <ChoiceChips
              name="theme"
              label="Colours"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "lime", label: "Lime" },
                { value: "light", label: "Light" },
              ]}
            />
          </Field>
        </>
      )}

      <Field label="Show it for" group>
        <Stepper name="duration_seconds" label="Seconds" value={duration} onChange={setDuration} min={5} max={60} suffix="seconds" />
      </Field>

      {screens.length > 1 && (
        <Field label="On" group>
          <div className="space-y-2">
            <ChoiceChips
              name="all_screens"
              label="Screens"
              value={allScreens ? "on" : "off"}
              onChange={(v) => setAllScreens(v === "on")}
              options={[
                { value: "on", label: "Every screen" },
                { value: "off", label: "Some screens" },
              ]}
            />
            {!allScreens && (
              <div className="flex flex-wrap gap-2">
                {screens.map((s) => (
                  <label key={s.id} className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-sm ring-1 ${picked.has(s.id) ? "bg-ink text-white ring-ink" : "bg-surface ring-line"}`}>
                    <input type="checkbox" name="screen" value={s.id} checked={picked.has(s.id)} onChange={() => setPicked((p) => toggle(p, s.id))} className="sr-only" />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </Field>
      )}

      <div className="rounded-xl bg-canvas p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={when} onChange={(e) => setWhen(e.target.checked)} className="size-4 accent-ink" /> Only at certain times
        </label>
        {when && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From" optional>
                <input name="starts_on" type="date" defaultValue={initial?.starts_on ?? ""} className={inputClass} />
              </Field>
              <Field label="Until" optional>
                <input name="ends_on" type="date" defaultValue={initial?.ends_on ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Days" group optional hint="None ticked: every day.">
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(([d, label]) => (
                  <label key={d} className={`grid h-9 w-12 cursor-pointer place-items-center rounded-lg text-sm font-medium ring-1 ${days.has(d) ? "bg-ink text-white ring-ink" : "bg-surface ring-line"}`}>
                    <input type="checkbox" name="weekday" value={d} checked={days.has(d)} onChange={() => setDays((s) => toggle(s, d))} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From time" optional>
                <input name="time_from" type="time" defaultValue={initial?.time_from?.slice(0, 5) ?? ""} className={inputClass} />
              </Field>
              <Field label="Until time" optional>
                <input name="time_to" type="time" defaultValue={initial?.time_to?.slice(0, 5) ?? ""} className={inputClass} />
              </Field>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export function ScreenForm({ action, initial, submitLabel }: { action: Action; initial?: { name: string; orientation: string }; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [orientation, setOrientation] = useState(initial?.orientation ?? "landscape");
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={initial?.name} placeholder="e.g. Lobby TV" className={inputClass} autoFocus />
      </Field>
      <Field label="The screen is" group>
        <ChoiceChips
          name="orientation"
          label="Orientation"
          value={orientation}
          onChange={setOrientation}
          options={[
            { value: "landscape", label: "Wide (landscape)" },
            { value: "portrait", label: "Tall (portrait)" },
          ]}
        />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
