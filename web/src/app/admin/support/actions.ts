"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/session";

export async function adminReply(ticketId: string, body: string, internal: boolean) {
  await requirePlatformAdmin();
  if (!body.trim()) return { error: "Write a message." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", { p_ticket_id: ticketId, p_body: body.trim().slice(0, 4000), p_internal: internal });
  if (error) return { error: error.message };
  refresh();
  return { ok: true as const };
}

export async function adminSetTicket(ticketId: string, patch: { status?: string; priority?: string; assignMe?: boolean; unassign?: boolean }) {
  const viewer = await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_ticket", {
    p_ticket_id: ticketId,
    p_status: patch.status,
    p_priority: patch.priority,
    p_assign: patch.assignMe ? viewer.id : undefined,
    p_unassign: patch.unassign ?? false,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true as const };
}

export async function adminReadTicket(ticketId: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("read_support_ticket", { p_ticket_id: ticketId });
}
