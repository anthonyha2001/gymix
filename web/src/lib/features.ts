import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Feature switches, set by the super admin (/admin, Lab tab): off, lab gyms
// only, or everyone, with per-gym exceptions. Keys match public.features.
export type FeatureKey =
  | "whatsapp"
  | "shake_to_open"
  | "drop_animation"
  | "self_pause"
  | "access_control";

const ALL: FeatureKey[] = ["whatsapp", "shake_to_open", "drop_animation", "self_pause"];

export const gymFeatures = cache(async (gymId: string): Promise<Set<string>> => {
  // Service role: also used where nobody is signed in (cron, WhatsApp).
  const { data, error } = await createAdminClient().rpc("gym_features", { p_gym_id: gymId });
  // If the switches can't be read, keep what was live before they existed
  // (newer features stay off).
  if (error) return new Set(ALL);
  return new Set(data ?? []);
});

export async function hasFeature(gymId: string, key: FeatureKey) {
  return (await gymFeatures(gymId)).has(key);
}
