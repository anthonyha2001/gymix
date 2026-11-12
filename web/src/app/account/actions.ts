"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";

// Deletes the signed-in person's account: their personal app data first (in
// the database, where it's checked and tested), then their photo, then the
// login itself. The gym keeps its own records of them (payments, visits).
export async function deleteMyAccount(confirm: string): Promise<{ error?: string; ok?: true }> {
  if (confirm.trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const viewer = await getViewer();
  if (!viewer) return { error: "Your session ended. Log in again, then delete your account." };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", viewer.id).maybeSingle();

  const { error } = await supabase.rpc("delete_my_account_data");
  if (error) return { error: error.message || "Couldn't delete your account. Try again." };

  const admin = createAdminClient();
  if (profile?.avatar_path) await admin.storage.from("gym-media").remove([profile.avatar_path]);
  const { error: authError } = await admin.auth.admin.deleteUser(viewer.id);
  if (authError) {
    console.error("deleteMyAccount: auth delete failed", authError.message);
    return { error: "Your data was removed, but the login couldn't be closed. Try again in a minute." };
  }
  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
}
