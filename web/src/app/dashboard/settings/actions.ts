"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";
import { PORTAL_PAGES } from "@/lib/portal-pages";

export async function saveGymSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const name = text(formData, "name");
  const rate = money(formData, "lbp_rate");
  const grace = Number(formData.get("unpaid_grace_days"));
  const reminder = Number(formData.get("renewal_reminder_days"));
  if (name.length < 2 || name.length > 80) return { error: "Gym name must be between 2 and 80 characters." };
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Enter the lira rate, e.g. 89500." };
  if (!Number.isInteger(grace) || grace < 0 || grace > 60) return { error: "Days to pay must be between 0 and 60." };
  if (!Number.isInteger(reminder) || reminder < 0 || reminder > 30) return { error: "Reminder days must be between 0 and 30." };

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ name, lbp_rate: rate, unpaid_grace_days: grace, renewal_reminder_days: reminder }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save settings.") };
  refresh();
  return { success: "Saved." };
}

export async function rotateStickerLink(): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_checkin_token", { p_gym_id: membership.gymId });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "New link created. Rewrite your stickers with it — the old ones no longer work." };
}

export async function setTapSimulator(enabled: boolean): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ tap_simulator: enabled }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: enabled ? "Tap simulator on (testing mode)." : "Tap simulator off. Only real stickers work now." };
}

// The owner chooses which portal pages members see: every page left unticked is hidden.
export async function setPortalPages(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const shown = new Set(formData.getAll("page").map(String));
  const hidden = PORTAL_PAGES.map((p) => p.id).filter((id) => !shown.has(id));
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ portal_hidden: hidden }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Saved. Members see the new set of pages right away." };
}
