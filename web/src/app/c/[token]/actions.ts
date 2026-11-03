"use server";

import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/action-result";
import { requireViewer } from "@/lib/session";

export type TapResult =
  | { ok: true; allowed: boolean; alreadyIn: boolean; reason: string | null; fullName: string | null;
      planName: string | null; endsOn: string | null; visitsLeft: number | null }
  | { ok: false; error: string };

export async function selfCheckIn(token: string): Promise<TapResult> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("self_check_in", { p_token: token }).single();
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
