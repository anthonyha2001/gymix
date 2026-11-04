"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";

// Marks the given notifications read (all of the user's, when none are given).
export async function markNotificationsRead(ids?: string[]) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: ids });
  refresh();
}
