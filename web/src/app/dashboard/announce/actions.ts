"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { errorMessage } from "@/lib/action-result";

export type Audience = "members" | "expiring" | "inactive" | "staff" | "everyone";

// How many people an announcement to this group would reach.
export async function reachOf(audience: Audience) {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { data } = await supabase.rpc("announcement_reach", { p_gym_id: membership.gymId, p_audience: audience });
  return data ?? 0;
}

export async function sendAnnouncement(input: { audience: Audience; title: string; body: string }): Promise<{ error?: string; sent?: number }> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const title = input.title.trim();
  if (title.length < 2) return { error: "Write a title." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_announcement", {
    p_gym_id: membership.gymId,
    p_audience: input.audience,
    p_title: title.slice(0, 80),
    p_body: input.body.trim().slice(0, 300) || undefined,
  });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { sent: data ?? 0 };
}

// Settings for the automatic messages (owners).
export async function saveAutomations(input: { winbackDays: number | null; dailySummary: boolean }) {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ winback_days: input.winbackDays, daily_summary: input.dailySummary })
    .eq("id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { ok: true as const };
}
