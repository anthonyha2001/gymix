import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Emails in SUPER_ADMIN_EMAILS (comma-separated) become Gymix super admins the
// first time they log in, so the owner of the platform never has to edit the
// database by hand. Removing an email here does not demote it; delete its
// row from platform_admins for that.
export function isConfiguredSuperAdmin(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Adds the user to platform_admins when their email is configured. Returns
// true when they are (now) a super admin through the setting.
export async function promoteConfiguredSuperAdmin(userId: string, email: string | null | undefined) {
  if (!isConfiguredSuperAdmin(email) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const { error } = await createAdminClient().from("platform_admins").upsert({ user_id: userId }, { onConflict: "user_id" });
  return !error;
}
