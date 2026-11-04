"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { Camera, Check } from "lucide-react";
import { showToast } from "@/components/toaster";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
import { WEEKDAYS } from "@/lib/schedule";
import { changePassword, saveNotificationPrefs, savePhoto, saveProfile, saveTrainingDays } from "./actions";

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function PhotoForm({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  const [state, action, pending] = useActionState(savePhoto, {});
  return (
    <form action={action} className="flex items-center gap-4">
      <label className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-brand text-2xl font-bold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : initials}
        <span className="absolute inset-0 grid place-items-center bg-ink/50 text-white opacity-0 transition group-hover:opacity-100">
          <Camera className="size-6" />
        </span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Profile photo"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
      <div className="text-sm">
        <p className="font-medium">{pending ? "Uploading…" : "Profile photo"}</p>
        <p className="text-muted">Tap the circle to {photoUrl ? "change it" : "add one"}. JPG, PNG or WebP.</p>
        {state.error && <p className="text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="full_name" required defaultValue={fullName} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={phone} className={inputClass} />
        </Field>
      </div>
      {email && !email.endsWith(".invalid") && <p className="text-sm text-muted">Email: {email}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

type ProgramDay = { id: string; name: string; programName: string };

export function TrainingDaysForm({ initial, programDays }: { initial: { weekday: number; programDayId: string | null }[]; programDays: ProgramDay[] }) {
  const [days, setDays] = useState(() => new Map(initial.map((d) => [d.weekday, d.programDayId])));
  const [pending, start] = useTransition();
  const toggle = (w: number) =>
    setDays((m) => {
      const next = new Map(m);
      if (next.has(w)) next.delete(w);
      else {
        // Suggest the next program day in order.
        next.set(w, programDays[next.size % Math.max(programDays.length, 1)]?.id ?? null);
      }
      return next;
    });
  const ordered = WEEK.filter((w) => days.has(w));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK.map((w) => {
          const on = days.has(w);
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(w)}
              className={`flex h-14 flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition active:scale-95 ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}
            >
              {WEEKDAYS[w].slice(0, 3)}
              {on && <Check className="mt-0.5 size-3.5 text-brand" />}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        Weekly goal: <strong className="text-ink">{ordered.length || 3} workouts</strong>
        {ordered.length ? "" : " (until you pick your days)"}. We remind you on these days.
      </p>
      {ordered.length > 0 && programDays.length > 0 && (
        <ul className="space-y-2">
          {ordered.map((w) => (
            <li key={w} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
              <span className="text-sm font-medium">{WEEKDAYS[w]}</span>
              <SearchSelect
                aria-label={`${WEEKDAYS[w]} workout`}
                value={days.get(w) ?? ""}
                onChange={(e) => setDays((m) => new Map(m).set(w, e.target.value || null))}
                className={inputClass}
              >
                <option value="">Any (I decide on the day)</option>
                {programDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.programName}
                  </option>
                ))}
              </SearchSelect>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveTrainingDays(ordered.map((w) => ({ weekday: w, programDayId: days.get(w) ?? null })));
            showToast(r.error ?? r.success ?? "Saved.", r.error ? "error" : "success");
          })
        }
      >
        {pending ? "Saving…" : "Save training days"}
      </Button>
    </div>
  );
}

const PREFS = [
  { key: "training", label: "Training reminders", hint: "On your training days, and when you set a record" },
  { key: "classes", label: "Classes", hint: "The day before a class you booked" },
  { key: "payments", label: "Payments", hint: "Course payments and membership ending" },
  { key: "messages", label: "Messages", hint: "When your trainer writes to you" },
];

export function NotificationPrefsForm({ initial }: { initial: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState(initial);
  const [, start] = useTransition();
  const set = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    start(async () => {
      const r = await saveNotificationPrefs(next);
      if (r.error) showToast(r.error, "error");
    });
  };
  return (
    <ul className="divide-y divide-line">
      {PREFS.map((p) => (
        <li key={p.key} className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm">
            <span className="block font-medium">{p.label}</span>
            <span className="text-muted">{p.hint}</span>
          </span>
          <Switch on={prefs[p.key] !== false} onChange={(v) => set(p.key, v)} label={p.label} />
        </li>
      ))}
    </ul>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-line"}`}
    >
      <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

// Shake to start: kept in this browser. iPhones need a one-time permission.
const SHAKE_KEY = "gymix:shake";
const readShake = () => {
  try {
    return localStorage.getItem(SHAKE_KEY) !== "off";
  } catch {
    return true;
  }
};
const subscribeShake = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("gymix:shake-pref", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("gymix:shake-pref", cb);
  };
};

export function ShakeSetting() {
  const on = useSyncExternalStore(subscribeShake, readShake, () => true);
  const set = async (value: boolean) => {
    if (value) {
      const Motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof Motion?.requestPermission === "function") {
        const answer = await Motion.requestPermission().catch(() => "denied");
        if (answer !== "granted") {
          showToast("Allow motion access to use shake to start.", "error");
          return;
        }
      }
    }
    try {
      localStorage.setItem(SHAKE_KEY, value ? "on" : "off");
    } catch {}
    window.dispatchEvent(new Event("gymix:shake-pref"));
  };
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm">
        <span className="block font-medium">Shake to start</span>
        <span className="text-muted">Shake your phone to bring up today&apos;s workout.</span>
      </span>
      <Switch on={on} onChange={set} label="Shake to start" />
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" hint="At least 8 characters.">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </Field>
        <Field label="Type it again">
          <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
