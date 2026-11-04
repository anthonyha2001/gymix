"use server";

import { refresh } from "next/cache";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

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
