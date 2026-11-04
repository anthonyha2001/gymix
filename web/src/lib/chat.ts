import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ConversationSummary = {
  id: string;
  otherName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
};

// Members can't read staff profiles (privacy), so staff names come from
// gym_coaches(), which exposes names only.
export async function coachNames(supabase: Client, gymId: string) {
  const { data } = await supabase.rpc("gym_coaches", { p_gym_id: gymId });
  return new Map((data ?? []).map((c) => [c.id, c.full_name]));
}

// The signed-in user's conversations (RLS returns only ones they're in).
// `as` decides whose name to show: the member's (for staff) or the staff's (for members).
export async function loadConversations(supabase: Client, viewerId: string, as: "staff" | "member", gymId: string) {
  const [{ data: convs }, { data: unread }, names] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, staff_id, last_message_at, members(full_name), messages(body, created_at)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" }),
    supabase.from("messages").select("conversation_id").is("read_at", null).neq("sender_id", viewerId).limit(1000),
    coachNames(supabase, gymId),
  ]);
  return (convs ?? []).map(
    (c): ConversationSummary => ({
      id: c.id,
      otherName: (as === "staff" ? c.members?.full_name : names.get(c.staff_id)) || "Unknown",
      lastMessage: c.messages[0]?.body ?? null,
      lastMessageAt: c.last_message_at,
      unread: (unread ?? []).filter((u) => u.conversation_id === c.id).length,
    }),
  );
}

export async function unreadCount(supabase: Client, viewerId: string) {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", viewerId);
  return count ?? 0;
}

export async function loadThread(supabase: Client, conversationId: string) {
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, gym_id, member_id, staff_id, members(full_name, user_id)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  // Opening the thread marks the other person's messages as read.
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .limit(500);
  const staffName = (await coachNames(supabase, conv.gym_id)).get(conv.staff_id) ?? null;
  return { conv, staffName, messages: messages ?? [] };
}
