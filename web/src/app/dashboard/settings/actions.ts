"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";

export async function saveGymSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const name = text(formData, "name");
  const rate = money(formData, "lbp_rate");
  if (name.length < 2 || name.length > 80) return { error: "Gym name must be between 2 and 80 characters." };
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Enter the lira rate, e.g. 89500." };

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ name, lbp_rate: rate }).eq("id", membership.gymId);
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
