"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";

// The member app checking whether its member is still at the gym (see
// public.presence_ping). Returns 'here' | 'left' | 'unsure' | 'not_in' | 'off'.
export async function presencePing(lat: number, lng: number, accuracy: number): Promise<string> {
  const { membership } = await requireMember();
  if (![lat, lng, accuracy].every(Number.isFinite)) return "unsure";
  const supabase = await createClient();
  const { data } = await supabase.rpc("presence_ping", { p_gym_id: membership.gymId, p_lat: lat, p_lng: lng, p_accuracy_m: accuracy });
  return typeof data === "string" ? data : "unsure";
}
