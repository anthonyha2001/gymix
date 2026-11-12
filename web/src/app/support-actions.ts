"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

// Gym staff talking to Gymix support (the Help button in the dashboard).

export type MyTicket = { id: string; number: number; subject: string; status: string; last_message_at: string; user_unread: boolean };
export type TicketMessage = { id: string; body: string; from_gymix: boolean; internal: boolean; created_at: string; author_id: string | null };

export async function myTickets(): Promise<MyTicket[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, number, subject, status, last_message_at, user_unread")
    .eq("user_id", viewer.id)
    .order("last_message_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function ticketThread(id: string): Promise<{ ticket: MyTicket | null; messages: TicketMessage[] }> {
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("support_tickets").select("id, number, subject, status, last_message_at, user_unread").eq("id", id).maybeSingle(),
    supabase.from("support_messages").select("id, body, from_gymix, internal, created_at, author_id").eq("ticket_id", id).order("created_at"),
  ]);
  if (ticket?.user_unread) await supabase.rpc("read_support_ticket", { p_ticket_id: id });
  return { ticket: ticket ?? null, messages: messages ?? [] };
}

export async function openTicket(input: { subject: string; body: string; category: string; gymId?: string | null; path?: string }) {
  const viewer = await getViewer();
  if (!viewer) return { error: "Log in first" };
  if (input.subject.trim().length < 2 || input.body.trim().length < 2) return { error: "Write what it's about and the details." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_subject: input.subject.trim().slice(0, 140),
    p_body: input.body.trim().slice(0, 4000),
    p_category: input.category,
    p_gym_id: input.gymId ?? viewer.memberships[0]?.gymId ?? undefined,
    p_path: input.path?.slice(0, 300),
    p_device: (await headers()).get("user-agent")?.slice(0, 200) ?? undefined,
  });
  if (error) return { error: error.message };
  return { id: data as string };
}

export async function replyTicket(id: string, body: string) {
  if (!body.trim()) return { error: "Write a message." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", { p_ticket_id: id, p_body: body.trim().slice(0, 4000) });
  return error ? { error: error.message } : { ok: true as const };
}
