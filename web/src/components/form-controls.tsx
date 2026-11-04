"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { inputClass } from "@/components/ui";

// Form building blocks used across Gymix: one-tap choices instead of
// dropdowns for short lists, amounts with their unit, steppers, date
// shortcuts and foldable optional sections. All of them submit through
// ordinary named inputs, so server actions read them like any field.

type Option = { value: string; label: ReactNode; hint?: ReactNode };

// A row of tappable choices (radio buttons underneath).
export function ChoiceChips({
  name,
  options,
  defaultValue,
  value,
  onChange,
  label,
  size = "md",
  columns,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  label: string;
  size?: "md" | "lg";
  // Lay the choices out as an even grid instead of a wrapping row.
  columns?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={columns ? "grid gap-2" : "flex flex-wrap gap-2"}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={`group relative flex cursor-pointer select-none flex-col justify-center rounded-xl border border-line bg-surface text-sm transition duration-150 hover:border-ink/30 active:scale-[0.97] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
            size === "lg" ? "px-4 py-3 text-left" : "h-10 px-3.5 text-center font-medium"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            className="sr-only"
            {...(value !== undefined ? { checked: value === o.value, onChange: () => onChange?.(o.value) } : { defaultChecked: defaultValue === o.value, onChange: () => onChange?.(o.value) })}
          />
          <span className={size === "lg" ? "font-semibold" : ""}>{o.label}</span>
          {o.hint && <span className="text-xs text-muted group-has-[:checked]:text-white/70">{o.hint}</span>}
        </label>
      ))}
    </div>
  );
}

// An input with its unit written in ("$", "kg", "LBP", "min").
export function AffixInput({
  prefix,
  suffix,
  className = "",
  ...props
}: React.ComponentProps<"input"> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-muted">{prefix}</span>}
      <input
        {...props}
        className={`${inputClass} ${prefix ? (prefix.length > 1 ? "pl-12" : "pl-8") : ""} ${suffix ? "pr-14" : ""} ${className}`}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm font-medium text-muted">{suffix}</span>}
    </div>
  );
}

// − 12 + : for counts (sets, spots, visits, months).
export function Stepper({
  name,
  defaultValue,
  value: controlled,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  suffix,
}: {
  name?: string;
  defaultValue?: number;
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  suffix?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? min);
  const value = controlled ?? own;
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    setOwn(next);
    onChange?.(next);
  };
  return (
    <div className="inline-flex h-11 items-center rounded-xl border border-line bg-surface">
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - step)} className="grid h-full w-11 place-items-center text-muted transition hover:text-ink active:scale-90 disabled:opacity-30">
        <Minus className="size-4" />
      </button>
      <input
        name={name}
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n)) set(n);
        }}
        className="h-full w-14 bg-transparent text-center font-semibold tabular-nums outline-none"
      />
      {suffix && <span className="pr-1 text-sm text-muted">{suffix}</span>}
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + step)} className="grid h-full w-11 place-items-center text-muted transition hover:text-ink active:scale-90 disabled:opacity-30">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

// A date field with one-tap shortcuts underneath ("Today", "Tomorrow"…).
export function DateField({
  name,
  value: controlled,
  defaultValue,
  onChange,
  min,
  shortcuts,
  label,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  shortcuts: { label: string; value: string }[];
  label: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const value = controlled ?? own;
  const set = (v: string) => {
    setOwn(v);
    onChange?.(v);
  };
  return (
    <div className="space-y-2">
      <input name={name} type="date" aria-label={label} required min={min} value={value} onChange={(e) => set(e.target.value)} className={inputClass} />
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => set(s.value)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-95 ${value === s.value ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A titled group of fields; `optional` sections start folded away.
export function FormSection({
  title,
  description,
  optional = false,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!optional);
  return (
    <section className="space-y-3">
      {optional ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-left text-sm hover:border-ink/30">
          <span>
            <span className="font-semibold">{title}</span>
            <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">Optional</span>
            {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted transition duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      )}
      {/* Folded sections stay in the form (hidden), so typed values still submit. */}
      <div className={open ? "space-y-4" : "hidden"}>{children}</div>
    </section>
  );
}

// "Plan price $40 / Discount −$5 / Total $35" lines, like a receipt.
export function Summary({ rows, total }: { rows: { label: string; value: ReactNode; muted?: boolean }[]; total?: { label: string; value: ReactNode } }) {
  return (
    <div className="rounded-xl bg-canvas p-4 text-sm">
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className={`flex justify-between gap-4 ${r.muted ? "text-muted" : ""}`}>
            <dt>{r.label}</dt>
            <dd className="text-right tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      {total && (
        <div className="mt-3 flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
          <span>{total.label}</span>
          <span className="tabular-nums">{total.value}</span>
        </div>
      )}
    </div>
  );
}
