import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type GymRole } from "@/lib/roles";

export type Membership = {
  gymId: string;
  gymName: string;
  role: GymRole;
  timezone: string;
  lbpRate: number;
};

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  memberships: Membership[];
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("gym_users")
      .select("gym_id, role, gyms(name, timezone, lbp_rate)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? "",
    memberships: (rows ?? []).map((r) => ({
      gymId: r.gym_id,
      gymName: r.gyms?.name ?? "",
      role: r.role,
      timezone: r.gyms?.timezone ?? "Asia/Beirut",
      lbpRate: Number(r.gyms?.lbp_rate ?? 89500),
    })),
  };
}

// Where a signed-in user belongs: staff go to the dashboard, members to the portal,
// and people with no gym yet set one up.
export function homePathFor(viewer: { memberships: Pick<Membership, "role">[] }) {
  if (viewer.memberships.some((m) => isStaffRole(m.role))) return "/dashboard";
  if (viewer.memberships.length > 0) return "/portal";
  return "/onboarding";
}

// Same as homePathFor, for use right after sign-in with the client that holds the new session.
export async function homePathForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("gym_users").select("role").eq("user_id", userId);
  return homePathFor({
    memberships: (data ?? []).map((r) => ({ role: r.role })),
  });
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

// Staff only; pass `roles` to narrow further (others are sent to the overview).
export async function requireStaff(roles?: GymRole[]) {
  const viewer = await requireViewer();
  const membership = viewer.memberships.find((m) => isStaffRole(m.role));
  if (!membership) redirect(homePathFor(viewer));
  if (roles && !roles.includes(membership.role)) redirect("/dashboard");
  return { viewer, membership };
}

export async function requireMember() {
  const viewer = await requireViewer();
  const membership = viewer.memberships.find((m) => m.role === "member");
  if (!membership) redirect(homePathFor(viewer));
  return { viewer, membership };
}
