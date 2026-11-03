import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton, buttonClass, inputClass } from "@/components/ui";
import { ROLE_LABELS, assignableRoles, isStaffRole, type GymRole } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cancelInvite, changeRole, removeFromGym } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted">
          Your managers, front desk and trainers. Members are on the{" "}
          <Link href="/dashboard/members" className="underline underline-offset-4">
            Members
          </Link>{" "}
          page.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <TeamContent />
      </Suspense>
    </div>
  );
}

type Person = { userId: string; role: GymRole; name: string; email: string; joinedAt: string };

async function TeamContent() {
  const { viewer, membership } = await requireStaff();
  const supabase = await createClient();

  const [{ data: roster }, { data: invites }] = await Promise.all([
    supabase
      .from("gym_users")
      .select("user_id, role, created_at, profiles(full_name, email)")
      .eq("gym_id", membership.gymId)
      .order("created_at"),
    supabase
      .from("invites")
      .select("id, email, role, created_at")
      .eq("gym_id", membership.gymId)
      .is("accepted_at", null)
      .neq("role", "member")
      .order("created_at", { ascending: false }),
  ]);

  const people: Person[] = (roster ?? []).map((r) => ({
    userId: r.user_id,
    role: r.role,
    name: r.profiles?.full_name ?? "",
    email: r.profiles?.email ?? "",
    joinedAt: r.created_at,
  }));
  const staff = people.filter((p) => isStaffRole(p.role));

  // Member invites live on the Members page; this page only assigns staff roles.
  const canAssign: GymRole[] = assignableRoles(membership.role).filter(isStaffRole);
  const canManage = (p: Person) => p.userId !== viewer.id && canAssign.includes(p.role);

  return (
    <div className="space-y-6">
      {canAssign.length > 0 && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Invite a team member</h2>
            <p className="text-sm text-muted">
              They sign up at Gymix with this email and land straight in your gym.
            </p>
          </div>
          <InviteForm roles={canAssign} />
        </Card>
      )}

      {invites && invites.length > 0 && (
        <Card>
          <h2 className="px-6 pt-5 pb-3 font-semibold">Pending invites ({invites.length})</h2>
          <ul className="divide-y divide-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted">
                    {ROLE_LABELS[inv.role]} · invited {formatDate(inv.created_at)}
                  </p>
                </div>
                {canAssign.includes(inv.role) && (
                  <form action={cancelInvite.bind(null, inv.id)}>
                    <button className={buttonClass("ghost", "h-8 px-3")}>Cancel</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PeopleList title="Staff" people={staff} canManage={canManage} assignable={canAssign} viewerId={viewer.id} />
    </div>
  );
}

function PeopleList({
  title,
  people,
  canManage,
  assignable,
  viewerId,
  empty,
}: {
  title: string;
  people: Person[];
  canManage: (p: Person) => boolean;
  assignable: GymRole[];
  viewerId: string;
  empty?: string;
}) {
  return (
    <Card>
      <h2 className="px-6 pt-5 pb-3 font-semibold">
        {title} ({people.length})
      </h2>
      {people.length === 0 ? (
        <p className="px-6 pb-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.name || p.email}
                  {p.userId === viewerId && <span className="ml-2 text-xs text-muted">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {p.name ? `${p.email} · ` : ""}joined {formatDate(p.joinedAt)}
                </p>
              </div>
              {canManage(p) ? (
                <div className="flex items-center gap-2">
                  <form action={changeRole.bind(null, p.userId)} className="flex items-center gap-2">
                    <select
                      name="role"
                      defaultValue={p.role}
                      aria-label={`Role for ${p.name || p.email}`}
                      className={`${inputClass} h-8 w-36`}
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button className={buttonClass("secondary", "h-8 px-3")}>Save</button>
                  </form>
                  <form action={removeFromGym.bind(null, p.userId)}>
                    <button className={buttonClass("danger", "h-8 px-3")}>Remove</button>
                  </form>
                </div>
              ) : (
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{ROLE_LABELS[p.role]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
