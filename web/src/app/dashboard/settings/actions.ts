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

// "Phone must be at the gym": taps on the check-in sticker (and door stickers)
// only count within 150 m of the gym's saved location.
export async function setStickerRadius(on: boolean): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("door_lat, door_lng").eq("id", membership.gymId).single();
  if (on && (gym?.door_lat == null || gym.door_lng == null)) {
    return { error: "Set your gym's location first (Settings → Gym → Location)." };
  }
  const { error } = await supabase.rpc("set_door_location", {
    p_gym_id: membership.gymId,
    p_lat: on ? gym!.door_lat! : null,
    p_lng: on ? gym!.door_lng! : null,
    p_radius_m: 150,
  });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: on ? "Taps now only count within 150 m of the gym." : "Taps now work wherever the phone is." };
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

// Whether members can share programs with friends (QR code, AirDrop, link).
export async function setProgramSharing(mode: "off" | "own" | "all"): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  if (!["off", "own", "all"].includes(mode)) return { error: "Pick an option." };
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ program_sharing: mode }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Saved." };
}

// Where the gym is (Settings → Gym → Location): for the Gymix map, door
// stickers' "phone must be at the gym" and the live count.
export async function saveGymLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const clear = text(formData, "clear") === "1";
  const lat = Number(text(formData, "lat"));
  const lng = Number(text(formData, "lng"));
  if (!clear && (!text(formData, "lat") || !Number.isFinite(lat) || !Number.isFinite(lng))) {
    return { error: "Put the pin on your gym first." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gym_location", {
    p_gym_id: membership.gymId,
    p_lat: clear ? null : lat,
    p_lng: clear ? null : lng,
    p_address: clear ? undefined : text(formData, "address") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the location.") };
  refresh();
  return { success: clear ? "Location removed. Door stickers no longer check where the phone is." : "Location saved." };
}
