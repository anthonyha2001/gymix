"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";
import { errorMessage } from "@/lib/action-result";

// Swipe right (join) or left (skip). Returns an error message, or null.
export async function setChallengeEntry(challengeId: string, join: boolean): Promise<string | null> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("challenge_set_entry", { p_challenge_id: challengeId, p_join: join });
  if (error) return errorMessage(error, "Couldn't save that. Try again.");
  refresh();
  return null;
}

export type BoardRow = { rank: number; name: string; score: number; completed: boolean; is_me: boolean };

export async function loadBoard(challengeId: string): Promise<BoardRow[]> {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.rpc("challenge_board", { p_challenge_id: challengeId, p_limit: 50 });
  return (data ?? []).map((r) => ({ rank: r.rank, name: r.name, score: Number(r.score), completed: r.completed, is_me: r.is_me }));
}
