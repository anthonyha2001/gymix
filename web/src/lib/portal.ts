import "server-only";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_PAGES, type PortalPage } from "@/lib/portal-pages";

// Portal pages the gym owner has switched off.
export async function hiddenPortalPages(gymId: string): Promise<PortalPage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("gyms").select("portal_hidden").eq("id", gymId).single();
  return (data?.portal_hidden ?? []).filter((p): p is PortalPage => PORTAL_PAGES.some((x) => x.id === p));
}

// For a portal page: the member, or back to the portal home if the owner has
// switched this page off.
export async function requirePortalPage(page: PortalPage) {
  const member = await requireMember();
  if ((await hiddenPortalPages(member.membership.gymId)).includes(page)) redirect("/portal");
  return member;
}
