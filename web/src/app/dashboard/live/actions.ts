"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

async function requireLive() {
  const ctx = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(ctx.membership.gymId, "live_occupancy"))) redirect("/dashboard");
  return ctx;
}

export async function saveOccupancySettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireLive();
  const capRaw = text(formData, "capacity");
  const capacity = capRaw ? Number(capRaw) : null;
  const visit = Number(text(formData, "avg_visit_minutes"));
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) {
    return { error: "Capacity is a whole number of people (or empty if you don't have a limit)." };
  }
  if (!Number.isInteger(visit) || visit < 15 || visit > 300) return { error: "A usual visit is between 15 and 300 minutes." };
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ capacity, avg_visit_minutes: visit }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved." };
}

export async function addSensor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireLive();
  const name = text(formData, "name");
  if (!name || name.length > 60) return { error: "Give the counter a name, like “Entrance counter”." };
  const supabase = await createClient();
  const { error } = await supabase.from("occupancy_sensors").insert({ gym_id: membership.gymId, name });
  if (error) return { error: errorMessage(error, "Couldn't add the counter.") };
  refresh();
  return { success: "Counter added. Copy its address into the device." };
}

export async function deleteSensor(sensorId: string): Promise<ActionState> {
  const { membership } = await requireLive();
  const supabase = await createClient();
  const { error } = await supabase.from("occupancy_sensors").delete().eq("id", sensorId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't remove the counter.") };
  refresh();
  return { success: "Counter removed." };
}
