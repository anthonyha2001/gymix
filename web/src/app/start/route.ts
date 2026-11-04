import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/session";
import { promoteConfiguredSuperAdmin } from "@/lib/super-admin";

// Single post-login entry point: sends each user to the right part of the app.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Platform owners listed in SUPER_ADMIN_EMAILS go straight to the console.
  if (!viewer.isPlatformAdmin && (await promoteConfiguredSuperAdmin(viewer.id, viewer.email))) redirect("/admin");
  redirect(homePathFor(viewer));
}
