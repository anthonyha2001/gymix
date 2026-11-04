"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGymUser } from "@/lib/session";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

const FIELDS = ["weight_kg", "body_fat_pct", "muscle_mass_kg", "waist_cm", "chest_cm", "hips_cm", "arm_cm", "thigh_cm"] as const;

// Members record their own (memberId = null); coaches record for a member.
// The database checks who may record for whom.
export async function addMeasurement(memberId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireGymUser();
  const supabase = await createClient();

  let targetId = memberId;
  if (!targetId) {
    const { data } = await supabase.rpc("my_member_id", { p_gym_id: membership.gymId });
    targetId = data ?? null;
  }
  if (!targetId) return { error: "Your account isn't linked to a membership yet." };

  const measuredOn = text(formData, "measured_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn)) return { error: "Choose the date." };

  const values: Partial<Record<(typeof FIELDS)[number], number>> = {};
  for (const f of FIELDS) {
    const raw = text(formData, f).replace(",", ".");
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: "Numbers only, please." };
    values[f] = n;
  }
  if (!Object.keys(values).length) return { error: "Enter at least one measurement." };

  const { error } = await supabase.from("body_measurements").insert({
    gym_id: membership.gymId,
    member_id: targetId,
    measured_on: measuredOn,
    notes: text(formData, "notes") || null,
    recorded_by: viewer.id,
    ...values,
  });
  if (error) {
    if (error.code === "23514") return { error: "One of the numbers looks off — check the units (kg, %, cm)." };
    return { error: errorMessage(error, "Couldn't save.") };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteMeasurement(id: string): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").delete().eq("id", id);
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}
