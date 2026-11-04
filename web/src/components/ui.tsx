import type { ComponentProps, ReactNode } from "react";

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
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "w-full h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-brand";

// inputClass with a different width (appending a width class doesn't reliably beat w-full).
export function inputWidth(width: string) {
  return inputClass.replace("w-full", width);
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
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
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="grid size-7 place-items-center rounded-md bg-brand text-ink text-sm font-black">G</span>
      Gymix
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
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
