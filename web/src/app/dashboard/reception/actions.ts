"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/format";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { kickAccess } from "@/lib/access/server";

async function requireReception(roles = BILLING_ROLES) {
  const ctx = await requireStaff(roles);
  if (!(await hasFeature(ctx.membership.gymId, "self_service"))) redirect("/dashboard");
  return ctx;
}

export async function confirmPayment(intentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireReception();
  const method = text(formData, "method") as PaymentMethod;
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return { error: "Choose how they paid." };
  const lbpRaw = text(formData, "amount_lbp").replace(/[,\s]/g, "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_payment_intent", {
    p_intent_id: intentId,
    p_method: method,
    p_amount_lbp: method === "cash_lbp" && lbpRaw ? Number(lbpRaw) : undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't confirm the payment.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: "Paid. The membership is active and the kiosk shows it." };
}

export async function cancelPayment(intentId: string): Promise<ActionState> {
  await requireReception();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_payment_intent", { p_intent_id: intentId });
  if (error) return { error: errorMessage(error, "Couldn't cancel.") };
  refresh();
  return { success: "Cancelled." };
}

function readKiosk(formData: FormData) {
  const name = text(formData, "name");
  if (!name || name.length > 60) return { error: "Give the kiosk a name, like “Entrance tablet”." };
  return {
    kiosk: {
      name,
      allow_checkin: formData.get("allow_checkin") === "on",
      allow_join: formData.get("allow_join") === "on",
      allow_buy: formData.get("allow_buy") === "on",
    },
  };
}

export async function createKiosk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireReception(MANAGER_ROLES);
  const parsed = readKiosk(formData);
  if (!parsed.kiosk) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("kiosks").insert({ ...parsed.kiosk, gym_id: membership.gymId });
  if (error) return { error: errorMessage(error, "Couldn't add the kiosk.") };
  refresh();
  return { success: "Kiosk added. Open its link on the tablet." };
}

export async function updateKiosk(kioskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireReception(MANAGER_ROLES);
  const parsed = readKiosk(formData);
  if (!parsed.kiosk) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("kiosks").update(parsed.kiosk).eq("id", kioskId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved." };
}

export async function setKioskActive(kioskId: string, active: boolean): Promise<ActionState> {
  const { membership } = await requireReception(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("kiosks").update({ is_active: active }).eq("id", kioskId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't update the kiosk.") };
  refresh();
  return { success: active ? "Kiosk switched on." : "Kiosk switched off." };
}

export async function deleteKiosk(kioskId: string): Promise<ActionState> {
  const { membership } = await requireReception(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("kiosks").delete().eq("id", kioskId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't remove the kiosk.") };
  refresh();
  return { success: "Kiosk removed." };
}

export async function savePaymentOptions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireReception(MANAGER_ROLES);
  const whish = text(formData, "kiosk_whish_number") || null;
  const omt = text(formData, "kiosk_omt_name") || null;
  if (whish && whish.length > 30) return { error: "The Whish number is too long." };
  if (omt && omt.length > 80) return { error: "The OMT name is too long." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ kiosk_whish_number: whish, kiosk_omt_name: omt, kiosk_card_terminal: formData.get("kiosk_card_terminal") === "on" })
    .eq("id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved. The kiosk offers these ways to pay." };
}
