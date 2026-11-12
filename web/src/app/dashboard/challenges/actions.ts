"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { isMetric } from "@/lib/challenges";

async function requireChallenges() {
  const ctx = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(ctx.membership.gymId, "challenges"))) redirect("/dashboard");
  return ctx;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readChallenge(formData: FormData) {
  const title = text(formData, "title");
  const metric = text(formData, "metric");
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");
  const targetRaw = text(formData, "target").replace(/[,\s]/g, "");
  const target = targetRaw ? Number(targetRaw) : null;
  const prize = text(formData, "prize") || null;
  const description = text(formData, "description") || null;

  if (title.length < 2 || title.length > 60) return { error: "Give the challenge a name (2 to 60 characters)." };
  if (!isMetric(metric)) return { error: "Choose what the challenge counts." };
  if (!DATE.test(startsOn) || !DATE.test(endsOn)) return { error: "Choose when it starts and ends." };
  if (endsOn < startsOn) return { error: "It has to end after it starts." };
  const days = (Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000;
  if (days > 92) return { error: "A challenge can last up to three months." };
  if (target !== null && (!Number.isInteger(target) || target < 1 || target > 100_000_000)) {
    return { error: "The goal is a whole number, or leave it empty for no goal." };
  }
  if (prize && prize.length > 120) return { error: "Keep the prize under 120 characters." };
  if (description && description.length > 300) return { error: "Keep the description under 300 characters." };
  return { challenge: { title, metric, starts_on: startsOn, ends_on: endsOn, target, prize, description } };
}

export async function createChallenge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireChallenges();
  const read = readChallenge(formData);
  if (!read.challenge) return { error: read.error };
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").insert({ ...read.challenge, gym_id: membership.gymId });
  if (error) return { error: errorMessage(error, "Couldn't post the challenge.") };
  refresh();
  return { success: `“${read.challenge.title}” is live. Members were notified.` };
}

export async function updateChallenge(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireChallenges();
  const read = readChallenge(formData);
  if (!read.challenge) return { error: read.error };
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").update(read.challenge).eq("id", id).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save the challenge.") };
  refresh();
  return { success: "Challenge saved." };
}

export async function deleteChallenge(id: string): Promise<ActionState> {
  const { membership } = await requireChallenges();
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").delete().eq("id", id).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't delete the challenge.") };
  refresh();
  return { success: "Challenge deleted." };
}
