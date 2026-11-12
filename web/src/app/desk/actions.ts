"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES } from "@/lib/roles";
import { formatTime } from "@/lib/format";

export type DeskSnapshot = {
  inside: number;
  today: number;
  recent: { id: string; name: string; time: string; allowed: boolean }[];
};

// The numbers and the last few arrivals on the front-desk tablet.
export async function deskSnapshot(): Promise<DeskSnapshot> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const [{ data: occ }, { data: rows }] = await Promise.all([
    supabase.rpc("gym_occupancy", { p_gym_id: membership.gymId }).maybeSingle(),
    supabase
      .from("checkins")
      .select("id, allowed, checked_in_at, members(full_name)")
      .eq("gym_id", membership.gymId)
      .order("checked_in_at", { ascending: false })
      .limit(8),
  ]);
  return {
    inside: occ?.people ?? 0,
    today: occ?.entries_today ?? 0,
    recent: (rows ?? []).map((r) => ({
      id: r.id,
      name: r.members?.full_name ?? "Member",
      time: formatTime(r.checked_in_at, membership.timezone),
      allowed: r.allowed,
    })),
  };
}
