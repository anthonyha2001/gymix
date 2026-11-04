import type { ComponentProps, ReactNode } from "react";
import { LogoMark } from "@/components/logo-mark";

// Small set of shared primitives. Server-safe (no hooks), so usable anywhere.

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "whatsapp";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85",
  whatsapp: "bg-[#1fa855] text-white hover:bg-[#1a9049]",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft",
  ghost: "text-muted hover:text-ink hover:bg-canvas",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-base sm:text-sm outline-none transition duration-150 placeholder:text-muted/70 hover:border-ink/25 focus:border-ink focus:ring-4 focus:ring-brand/40";

// inputClass with a different width (appending a width class doesn't reliably beat w-full).
export function inputWidth(width: string) {
  return inputClass.replace("w-full", width);
}

// A labelled field. `group` is for controls that aren't a single input
// (choice chips, steppers with their own labels), which can't sit in a <label>.
export function Field({
  label,
  hint,
  optional = false,
  group = false,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  group?: boolean;
  children: ReactNode;
}) {
  const head = (
    <span className="flex items-baseline gap-2 text-sm font-medium">
      {label}
      {optional && <span className="text-xs font-normal text-muted">Optional</span>}
    </span>
  );
  const tail = hint && <span className="block text-xs text-muted">{hint}</span>;
  return group ? (
    <div role="group" aria-label={label} className="block space-y-1.5">
      {head}
      {children}
      {tail}
    </div>
  ) : (
    <label className="block space-y-1.5">
      {head}
      {children}
      {tail}
    </label>
  );
}

// Pass a bg-*/border-* class to override the defaults (appending one doesn't reliably win).
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-surface";
  const border = /(^|\s)border-(?!t\b|b\b|l\b|r\b|x\b|y\b|dashed)/.test(className) ? "border" : "border border-line";
  return <div className={`rounded-xl ${border} ${bg} ${className}`} {...props} />;
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const styles = tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="grid size-[1.75em] shrink-0 place-items-center rounded-[22%] bg-brand text-ink">
        <LogoMark className="size-full" />
      </span>
      Gymix
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md bg-line/70 ${className}`} />;
}

const BADGE_TONES = {
  green: "bg-success-soft text-success",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-danger-soft text-danger",
  blue: "bg-sky-50 text-sky-800",
  gray: "bg-canvas text-muted",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-5 text-sm text-muted">{children}</p>;
}
