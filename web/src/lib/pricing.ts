// Gymix's own price, trial length and grace period live in the database
// (platform_settings) and are changed by a super admin in /admin. Server code
// reads them with getPricing() from "@/lib/pricing-server"; these are only the
// fallbacks used when the database can't be reached.
export type Pricing = { priceUsd: number; trialDays: number; graceDays: number };
export const DEFAULT_PRICING: Pricing = { priceUsd: 19.99, trialDays: 14, graceDays: 3 };

// "$10" or "$9.99".
export function formatPrice(usd: number) {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

// Everything is included in the one plan.
export const PLAN_FEATURES = [
  "Unlimited members and staff",
  "Memberships, invoices and payments in USD and LBP",
  "NFC tap and QR check-in",
  "Member app for iPhone and Android",
  "Programs built by your trainers",
  "Nutrition plans from your dietitian",
  "Classes, monthly courses and personal training",
  "Machine stickers with how-to animations",
  "Calendar schedule with bookings",
  "Automatic WhatsApp reminders and receipts",
  "Notifications and reminders",
  "Automatic freeze for unpaid accounts",
] as const;

export type SubscriptionStatus = "trial" | "active" | "grace" | "expired" | "suspended";

export function subscriptionStatus(
  trialEndsAt: string,
  paidUntil: string | null,
  today: string,
  graceDays: number,
  suspended = false,
): SubscriptionStatus {
  if (suspended) return "suspended";
  const end = paidUntil && paidUntil > trialEndsAt ? paidUntil : trialEndsAt;
  if (paidUntil && paidUntil >= today) return "active";
  if (end >= today) return "trial";
  const grace = new Date(`${end}T00:00:00Z`);
  grace.setUTCDate(grace.getUTCDate() + graceDays);
  return grace.toISOString().slice(0, 10) >= today ? "grace" : "expired";
}

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  trial: { label: "Free trial", tone: "blue" },
  active: { label: "Active", tone: "green" },
  grace: { label: "Payment due", tone: "amber" },
  expired: { label: "Ended", tone: "red" },
  suspended: { label: "Suspended", tone: "red" },
};
