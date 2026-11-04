// Gymix's own price. Change it here and the landing page, pricing and
// subscription screens all follow. (The trial length is set in the database:
// gyms.trial_ends_at defaults to 14 days after sign-up.)
export const PRICE_USD = 10;
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;

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
  "Notifications and reminders",
  "Automatic freeze for unpaid accounts",
] as const;

export type SubscriptionStatus = "trial" | "active" | "grace" | "expired";

export function subscriptionStatus(trialEndsAt: string, paidUntil: string | null, today: string): SubscriptionStatus {
  const end = paidUntil && paidUntil > trialEndsAt ? paidUntil : trialEndsAt;
  if (paidUntil && paidUntil >= today) return "active";
  if (end >= today) return "trial";
  const grace = new Date(`${end}T00:00:00Z`);
  grace.setUTCDate(grace.getUTCDate() + GRACE_DAYS);
  return grace.toISOString().slice(0, 10) >= today ? "grace" : "expired";
}

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  trial: { label: "Free trial", tone: "blue" },
  active: { label: "Active", tone: "green" },
  grace: { label: "Payment due", tone: "amber" },
  expired: { label: "Ended", tone: "red" },
};
