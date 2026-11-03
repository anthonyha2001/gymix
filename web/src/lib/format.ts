// Client-safe formatting for money, dates and enum labels.

import type { Database } from "@/lib/supabase/database.types";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PlanPeriod = Database["public"]["Enums"]["plan_period"];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash_usd", label: "Cash (USD)" },
  { value: "cash_lbp", label: "Cash (LBP)" },
  { value: "card", label: "Card" },
  { value: "whish", label: "Whish Money" },
  { value: "omt", label: "OMT" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])) as Record<
  PaymentMethod,
  string
>;

export const PLAN_PERIODS: { value: PlanPeriod; label: string; plural: string }[] = [
  { value: "day", label: "day", plural: "days" },
  { value: "week", label: "week", plural: "weeks" },
  { value: "month", label: "month", plural: "months" },
  { value: "year", label: "year", plural: "years" },
];

export function planLength(period: PlanPeriod, count: number) {
  const p = PLAN_PERIODS.find((x) => x.value === period)!;
  return count === 1 ? `1 ${p.label}` : `${count} ${p.plural}`;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const lbp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatUSD(value: number | string | null | undefined) {
  return usd.format(Number(value ?? 0));
}

export function formatLBP(value: number | string | null | undefined) {
  return `LBP ${lbp.format(Number(value ?? 0))}`;
}

// Lira amounts are rounded to the nearest 1,000 — smaller notes are rarely used.
export function usdToLbp(amountUsd: number, rate: number) {
  return Math.round((amountUsd * rate) / 1000) * 1000;
}

// Date-only strings ("2026-11-03") are calendar dates, so format them in UTC
// to avoid shifting a day in the viewer's timezone.
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(value.length === 10 ? { timeZone: "UTC" } : {}),
  });
}

export function formatDateTime(value: string, timeZone: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
}

// Today's date (YYYY-MM-DD) in the gym's timezone.
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type MemberStatus = "active" | "expired" | "frozen" | "upcoming" | "used_up" | "none";
export type InvoiceStatus = "paid" | "partial" | "unpaid" | "void";

export const MEMBER_STATUS: Record<MemberStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  upcoming: { label: "Starts soon", tone: "amber" },
  frozen: { label: "Frozen", tone: "blue" },
  expired: { label: "Expired", tone: "red" },
  used_up: { label: "No visits left", tone: "red" },
  none: { label: "No membership", tone: "gray" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "green" },
  partial: { label: "Part paid", tone: "amber" },
  unpaid: { label: "Unpaid", tone: "red" },
  void: { label: "Void", tone: "gray" },
};

export type Tone = "green" | "amber" | "red" | "blue" | "gray";
