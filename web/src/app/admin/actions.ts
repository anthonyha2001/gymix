"use server";

import { refresh, updateTag } from "next/cache";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PRICING_TAG } from "@/lib/pricing-server";

// A gym paid Gymix for some months.
export async function recordSubscriptionPayment(gymId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const months = Number(formData.get("months"));
  const amount = Number(formData.get("amount_usd"));
  const method = text(formData, "method");
  if (!Number.isInteger(months) || months < 1 || months > 36) return { error: "Months must be between 1 and 36." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the amount received." };
  if (!method) return { error: "Choose how they paid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_record_subscription_payment", {
    p_gym_id: gymId,
    p_months: months,
    p_amount_usd: amount,
    p_method: method,
    p_note: text(formData, "note"),
  });
  if (error) return { error: errorMessage(error, "Couldn't record the payment.") };
  refresh();
  return { success: `Payment recorded. Paid until ${formatDate(data)}.` };
}

export async function extendTrial(gymId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: "Days must be between 1 and 365." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_extend_trial", { p_gym_id: gymId, p_days: days });
  if (error) return { error: errorMessage(error, "Couldn't extend the trial.") };
  refresh();
  return { success: `Trial extended to ${formatDate(data)}.` };
}

// How gyms pay Gymix, shown on every owner's Subscription tab.
export async function savePlatformSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const instructions = text(formData, "payment_instructions");
  const whatsapp = text(formData, "whatsapp");
  if (instructions.length > 1000) return { error: "Keep the instructions under 1000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_platform_settings", { p_instructions: instructions, p_whatsapp: whatsapp });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved." };
}

// Price, trial length and grace period for every gym. The landing, pricing and
// subscription pages pick up the change immediately.
export async function savePricing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const price = Number(formData.get("price_usd"));
  const trialDays = Number(formData.get("trial_days"));
  const graceDays = Number(formData.get("grace_days"));
  if (!Number.isFinite(price) || price <= 0 || price > 10000) return { error: "Enter a monthly price above $0." };
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return { error: "Trial must be 0 to 365 days." };
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 60) return { error: "Grace period must be 0 to 60 days." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_pricing", {
    p_price_usd: Math.round(price * 100) / 100,
    p_trial_days: trialDays,
    p_grace_days: graceDays,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the pricing.") };
  updateTag(PRICING_TAG);
  refresh();
  return { success: "Pricing saved. New gyms get the new trial; the price shows everywhere now." };
}

// Locks (or reopens) a gym's staff dashboard. Members keep their app.
export async function setGymSuspended(gymId: string, suspended: boolean, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_gym_suspended", {
    p_gym_id: gymId,
    p_suspended: suspended,
    p_reason: text(formData, "reason"),
  });
  if (error) return { error: errorMessage(error, "Couldn't update the gym.") };
  refresh();
  return { success: suspended ? "Gym suspended." : "Gym reopened." };
}

// Removes monitoring events older than the chosen number of days.
export async function pruneEvents(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const keep = Number(formData.get("keep_days"));
  if (!Number.isInteger(keep) || keep < 7 || keep > 3650) return { error: "Keep between 7 and 3650 days." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_prune_events", { p_keep_days: keep });
  if (error) return { error: errorMessage(error, "Couldn't clean up.") };
  refresh();
  return { success: `Removed ${(data ?? 0).toLocaleString("en-US")} old events.` };
}
