"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireGymUser, requireMember, requireStaff } from "@/lib/session";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { withParam } from "@/lib/url";

export async function openChatAsMember(staffId: string): Promise<ActionState> {
  const { membership } = await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_conversation", { p_gym_id: membership.gymId, p_staff_id: staffId });
  if (error || !data) return { error: errorMessage(error ?? { message: "" }, "Couldn't open the chat.") };
  redirect(`/portal/messages?c=${data}`);
}

// Opens the chat as a dialog on the page the staff member is on (returnPath).
export async function openChatAsStaff(memberId: string, returnPath: string): Promise<ActionState> {
  const { membership } = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_conversation", { p_gym_id: membership.gymId, p_member_id: memberId });
  if (error || !data) return { error: errorMessage(error ?? { message: "" }, "Couldn't open the chat.") };
  redirect(withParam(returnPath, "c", data));
}

export async function sendMessage(conversationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireGymUser();
  const body = text(formData, "body");
  if (!body) return {};
  if (body.length > 2000) return { error: "Message is too long (2000 characters max)." };
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: viewer.id, body });
  if (error) return { error: errorMessage(error, "Couldn't send.") };
  refresh();
  return { success: "sent" };
}
