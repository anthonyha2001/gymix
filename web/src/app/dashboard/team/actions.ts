"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUnreachable, UNREACHABLE_MESSAGE } from "@/lib/supabase/config";
import { assignableRoles, isGymRole } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

// The database (RLS + can_assign_role) is the real guard on every action here;
// the checks below just give clearer error messages.

export type InviteState = { error?: string; success?: string };

export async function inviteToGym(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { viewer, membership } = await requireStaff();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!isGymRole(role) || !assignableRoles(membership.role).includes(role)) {
    return { error: "You can't invite someone with that role." };
  }

  const supabase = await createClient();

  // Already in this gym?
  const { data: existing } = await supabase
    .from("gym_users")
    .select("user_id, profiles!inner(email)")
    .eq("gym_id", membership.gymId)
    .eq("profiles.email", email)
    .maybeSingle();
  if (existing) return { error: `${email} is already part of ${membership.gymName}.` };

  const { error } = await supabase.from("invites").insert({
    gym_id: membership.gymId,
    email,
    role,
    invited_by: viewer.id,
  });
  if (error) {
    if (isUnreachable(error)) return { error: UNREACHABLE_MESSAGE };
    if (error.code === "23505") return { error: `${email} already has a pending invite.` };
    return { error: "Couldn't create the invite. Please try again." };
  }

  refresh();
  return {
    success: `Invite created for ${email} — copy their link from Pending invites.`,
  };
}

export async function cancelInvite(inviteId: string) {
  const { membership } = await requireStaff();
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("id", inviteId).eq("gym_id", membership.gymId);
  refresh();
}

export async function changeRole(userId: string, formData: FormData) {
  const { membership } = await requireStaff();
  const role = formData.get("role");
  if (!isGymRole(role) || !assignableRoles(membership.role).includes(role)) return;

  const supabase = await createClient();
  await supabase.from("gym_users").update({ role }).eq("gym_id", membership.gymId).eq("user_id", userId);
  refresh();
}

export async function removeFromGym(userId: string) {
  const { membership } = await requireStaff();
  const supabase = await createClient();
  await supabase.from("gym_users").delete().eq("gym_id", membership.gymId).eq("user_id", userId);
  refresh();
}
