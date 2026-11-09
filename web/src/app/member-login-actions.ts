"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES } from "@/lib/roles";
import { forgetNewLogin, generatePassword, memberLoginId } from "@/lib/member-login";
import { errorMessage } from "@/lib/action-result";

// The member has seen (and hopefully saved) their first login details.
export async function dismissNewLogin() {
  await forgetNewLogin();
}

export type ResetResult = { error?: string; loginId?: string; code?: string; password?: string };

// Front desk sets a new generated password for a member's account (e.g. new
// phone, forgotten password) and gets it back to hand over.
export async function resetMemberPassword(memberId: string): Promise<ResetResult> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("full_name, email, phone, checkin_code, user_id")
    .eq("id", memberId)
    .eq("gym_id", membership.gymId)
    .maybeSingle();
  if (!member) return { error: "Member not found." };
  if (!member.user_id) return { error: "This member hasn't joined the member app yet. Send them their invite link." };
  const { data: demoUser } = await createAdminClient().from("demo_users").select("user_id").eq("user_id", member.user_id).maybeSingle();
  if (demoUser) return { error: "In the demo, Karim's password stays as it is so you can switch to his app. With real members this gives them a new one." };

  const admin = createAdminClient();
  const password = generatePassword();
  const { data: user, error } = await admin.auth.admin.updateUserById(member.user_id, { password });
  if (error) return { error: errorMessage(error, "Couldn't reset the password.") };
  await supabase.rpc("log_activity", {
    p_gym_id: membership.gymId,
    p_action: "member.password_reset",
    p_summary: `Reset the app password for ${member.full_name}`,
  });

  // Members who joined with an email log in with it; others with phone or code.
  const realEmail = user.user.email && !user.user.email.endsWith("@members.gymix.invalid") ? user.user.email : null;
  return { loginId: memberLoginId({ ...member, email: realEmail }), code: member.checkin_code, password };
}
