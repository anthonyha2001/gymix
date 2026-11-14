"use server";

import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/action-result";
import { requireMember, requireViewer } from "@/lib/session";
import type { Spot } from "@/app/door-actions";

export type TapResult =
  | { ok: true; allowed: boolean; alreadyIn: boolean; reason: string | null; fullName: string | null;
      planName: string | null; endsOn: string | null; visitsLeft: number | null }
  | { ok: false; error: string };

type Row = {
  allowed: boolean;
  already_in: boolean;
  reason: string | null;
  full_name: string | null;
  plan_name: string | null;
  ends_on: string | null;
  visits_left: number | null;
};

function toResult(data: Row | null, error: { message: string; code?: string } | null): TapResult {
  if (error || !data) return { ok: false, error: error ? errorMessage(error, "Check-in failed. Ask the front desk.") : "Check-in failed." };
  return {
    ok: true,
    allowed: data.allowed,
    alreadyIn: data.already_in,
    reason: data.reason,
    fullName: data.full_name,
    planName: data.plan_name,
    endsOn: data.ends_on,
    visitsLeft: data.visits_left,
  };
}

// Real tap on the entrance sticker.
// spot: the phone's location, when the gym only accepts taps at the gym.
export async function selfCheckIn(token: string, spot: Spot | null = null): Promise<TapResult> {
  await requireViewer();
  const where = spot && [spot.lat, spot.lng, spot.accuracy].every(Number.isFinite) ? spot : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("self_check_in", { p_token: token, p_lat: where?.lat, p_lng: where?.lng, p_accuracy_m: where?.accuracy })
    .single();
  return toResult(data, error);
}

// Simulated tap (double-space in the member portal, while the gym allows it).
export async function simulatedCheckIn(): Promise<TapResult> {
  const { membership } = await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simulated_check_in", { p_gym_id: membership.gymId }).single();
  return toResult(data, error);
}
