"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireViewer } from "@/lib/session";
import { errorMessage, type ActionState } from "@/lib/action-result";
import { generatePassword, memberLoginId, rememberNewLogin } from "@/lib/member-login";

export async function acceptInvite(token: string): Promise<ActionState> {
  await requireViewer();
  const supabase = await createClient();
  const { data: role, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !role) return { error: errorMessage(error ?? { message: "" }, "Couldn't accept the invite.") };
  redirect(role === "member" ? "/portal" : "/dashboard");
}

// Member invite links are the credential: opening one creates the member's
// account and signs them in, with no email or password to type. A password is
// generated too and shown once in the portal, for logging in elsewhere. Runs on the
// button press (a POST), never on page load, so link previews in WhatsApp
// can't use it up. Each link works once.
export async function joinWithLink(token: string): Promise<ActionState> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, role, member_id, email, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite || invite.role !== "member" || !invite.member_id) return { error: "This link isn't valid. Ask your gym for a new one." };
  if (invite.accepted_at) return { error: "This link was already used. Log in, or ask your gym for a new link." };
  if (new Date(invite.expires_at) < new Date()) return { error: "This link has expired. Ask your gym for a new one." };

  const { data: member } = await admin.from("members").select("full_name, email, phone, checkin_code, user_id").eq("id", invite.member_id).single();
  if (!member) return { error: "This link isn't valid. Ask your gym for a new one." };
  if (member.user_id) return { error: "This member already has an account. Log in instead." };

  // Use the member's email when the gym has one; otherwise an internal address
  // that is never mailed (the account is reached through gym links).
  const email = (invite.email ?? member.email ?? `member-${invite.member_id}@members.gymix.invalid`).toLowerCase();
  const password = generatePassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: member.full_name },
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { error: `An account with ${email} already exists. Log in to join.` };
    return { error: errorMessage(createError ?? { message: "" }, "Couldn't open your portal.") };
  }

  // Sign the new account in on this device (a magic link verified server-side;
  // no email is sent).
  const supabase = await createClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const { error: verifyError } = linkError
    ? { error: linkError }
    : await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  const { error: acceptError } = verifyError ? { error: verifyError } : await supabase.rpc("accept_invite", { p_token: token });
  if (linkError || verifyError || acceptError) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: errorMessage(linkError ?? verifyError ?? acceptError ?? { message: "" }, "Couldn't open your portal.") };
  }
  const loginEmail = invite.email ?? member.email;
  await rememberNewLogin({ loginId: memberLoginId({ ...member, email: loginEmail }), code: member.checkin_code, password });
  redirect("/portal");
}
