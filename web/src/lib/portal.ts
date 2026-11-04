import "server-only";
import { cache } from "react";
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

export type AccountStatus = { frozen: boolean; frozenAt: string | null; overdueUsd: number; balanceUsd: number };

// The member's own account. Freezes it first when a balance is overdue; only a
// check-in after paying unfreezes it. Once per request.
export const accountStatus = cache(async (gymId: string): Promise<AccountStatus> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_account_status", { p_gym_id: gymId }).single();
  return {
    frozen: data?.frozen ?? false,
    frozenAt: data?.frozen_at ?? null,
    overdueUsd: Number(data?.overdue_usd ?? 0),
    balanceUsd: Number(data?.balance_usd ?? 0),
  };
});

// For any portal page but the home page: the member, or back to the portal home
// while their account is frozen for an unpaid balance.
export async function requireUnfrozenMember() {
  const member = await requireMember();
  if ((await accountStatus(member.membership.gymId)).frozen) redirect("/portal");
  return member;
}

// For a portal page: the member, or back to the portal home if the owner has
// switched this page off or the account is frozen.
export async function requirePortalPage(page: PortalPage) {
  const member = await requireUnfrozenMember();
  if ((await hiddenPortalPages(member.membership.gymId)).includes(page)) redirect("/portal");
  return member;
}
