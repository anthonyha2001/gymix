"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireStaff } from "@/lib/session";
import { BILLING_ROLES } from "@/lib/roles";
import { requestOrigin } from "@/lib/origin";
import { memberLoginId, readNewLogin } from "@/lib/member-login";
import { firstName, sendWhatsApp, type SendResult } from "@/lib/whatsapp";
import type { ActionState } from "@/lib/action-result";
import type { WhatsAppKind } from "@/lib/whatsapp-templates";

// Sending invites and login details straight from Gymix (the gym's number or
// the Gymix number), instead of opening WhatsApp on the staff's phone.

const PASSWORD_RE = /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/;

function outcome(r: SendResult, to: string): ActionState {
  if (r.status === "sent") return { success: `Sent on WhatsApp to ${to}.` };
  return { error: r.error ?? "Couldn't send it." };
}

// One manual send per member and kind every 30 seconds: a double tap can't
// send it twice.
async function tooSoon(memberId: string, kind: WhatsAppKind) {
  const { data } = await createAdminClient()
    .from("whatsapp_log")
    .select("id")
    .eq("member_id", memberId)
    .eq("kind", kind)
    .gt("created_at", new Date(Date.now() - 30_000).toISOString())
    .limit(1);
  return Boolean(data?.length);
}

export async function sendInviteOnWhatsApp(memberId: string): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone")
    .eq("id", memberId)
    .eq("gym_id", membership.gymId)
    .maybeSingle();
  if (!member) return { error: "Member not found." };
  if (!member.phone) return { error: "Add their phone number first." };
  if (await tooSoon(member.id, "invite")) return { error: "Just sent. Give it a minute before sending again." };
  const { data: token, error } = await supabase.rpc("member_invite_token", { p_member_id: member.id });
  if (error || !token) return { error: "Couldn't create the invite link." };

  const r = await sendWhatsApp({
    kind: "invite",
    ref: `${member.id}:${Date.now()}`,
    gymId: membership.gymId,
    memberId: member.id,
    phone: member.phone,
    params: [firstName(member.full_name), membership.gymName, `${await requestOrigin()}/join/${token}`],
    sentBy: viewer.id,
  });
  refresh();
  return outcome(r, member.phone);
}

// After "Generate a new password": the front desk sends it to the member.
export async function sendLoginOnWhatsApp(memberId: string, password: string): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(BILLING_ROLES);
  if (!PASSWORD_RE.test(password)) return { error: "Generate a new password first." };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email, checkin_code, user_id")
    .eq("id", memberId)
    .eq("gym_id", membership.gymId)
    .maybeSingle();
  if (!member?.user_id) return { error: "Member not found." };
  if (!member.phone) return { error: "Add their phone number first." };
  if (await tooSoon(member.id, "login")) return { error: "Just sent. Give it a minute before sending again." };

  const { data: user } = await createAdminClient().auth.admin.getUserById(member.user_id);
  const email = user?.user?.email && !user.user.email.endsWith("@members.gymix.invalid") ? user.user.email : null;
  const r = await sendWhatsApp({
    kind: "login",
    ref: `${member.id}:${Date.now()}`,
    gymId: membership.gymId,
    memberId: member.id,
    phone: member.phone,
    params: [firstName(member.full_name), membership.gymName, memberLoginId({ ...member, email }), password, `${await requestOrigin()}/login`],
    sentBy: viewer.id,
  });
  return outcome(r, member.phone);
}

// Right after joining: the member sends their own first login to their phone.
export async function sendMyLoginOnWhatsApp(): Promise<ActionState> {
  const { viewer, membership } = await requireMember();
  const login = await readNewLogin();
  if (!login) return { error: "These details were already cleared. Ask the front desk for a new password." };
  const { data: member } = await createAdminClient()
    .from("members")
    .select("id, full_name, phone")
    .eq("gym_id", membership.gymId)
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!member) return { error: "Member not found." };
  if (!member.phone) return { error: "Your gym doesn't have your phone number. Copy the details instead." };
  if (await tooSoon(member.id, "login")) return { error: "Just sent. Check your WhatsApp." };

  const r = await sendWhatsApp({
    kind: "login",
    ref: `${member.id}:${Date.now()}`,
    gymId: membership.gymId,
    memberId: member.id,
    phone: member.phone,
    params: [firstName(member.full_name), membership.gymName, login.loginId, login.password, `${await requestOrigin()}/login`],
    sentBy: viewer.id,
  });
  return outcome(r, member.phone);
}
