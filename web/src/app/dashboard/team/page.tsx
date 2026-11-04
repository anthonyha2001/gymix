import type { Metadata } from "next";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { InviteShare } from "@/components/invite-share";
import { Card, PageHeader, Skeleton, buttonClass, inputWidth } from "@/components/ui";
import { staffInviteMessage } from "@/lib/invite-link";
import { requestOrigin } from "@/lib/origin";
import { ROLE_LABELS, assignableRoles, isStaffRole, type GymRole } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cancelInvite, changeRole, removeFromGym } from "./actions";
import { InviteForm } from "./invite-form";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { SearchSelect } from "@/components/search-select";

export const metadata: Metadata = { title: "Team" };

const TABS = ["staff", "invites"] as const;

export default function TeamPage({ searchParams }: PageProps<"/dashboard/team">) {
  return (
    <div className="space-y-6 max-w-5xl">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <TeamContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Person = { userId: string; role: GymRole; name: string; email: string; joinedAt: string };

async function TeamContent({ searchParams }: { searchParams: PageProps<"/dashboard/team">["searchParams"] }) {
  const tab = activeTab((await searchParams).tab, TABS);
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
      .select("id, email, role, created_at, token")
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

  const origin = await requestOrigin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Your managers, front desk and trainers. Members are on the Members page."
        action={
          canAssign.length > 0 && (
            <Dialog label="Invite team member" icon={<UserPlus className="size-4" />} title="Invite a team member" description="They get a link to create their account and land straight in your gym.">
              <InviteForm roles={canAssign} />
            </Dialog>
          )
        }
      />

      <PageTabs instant
        base="/dashboard/team"
        active={tab}
        tabs={[
          { id: "staff", label: "Staff" },
          { id: "invites", label: "Pending invites", count: invites?.length ?? 0 },
        ]}
      />

      <TabPanel id="invites" tabs={TABS}>{!invites?.length && <Card className="p-6 text-sm text-muted">No pending invites.</Card>}</TabPanel>
      <TabPanel id="invites" tabs={TABS}>{invites && invites.length > 0 && (
        <Card>
          <h2 className="px-6 pt-5 pb-3 font-semibold">Pending invites ({invites.length})</h2>
          <ul className="divide-y divide-line">
            {invites.map((inv) => {
              const url = `${origin}/join/${inv.token}`;
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.email ?? "Link invite"}</p>
                    <p className="text-xs text-muted">
                      {ROLE_LABELS[inv.role]} · invited {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <InviteShare
                      url={url}
                      message={staffInviteMessage(membership.gymName, ROLE_LABELS[inv.role].toLowerCase(), url)}
                      compact
                    />
                    {canAssign.includes(inv.role) && (
                      <form action={cancelInvite.bind(null, inv.id)}>
                        <button className={buttonClass("ghost", "h-8 px-3")}>Cancel</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}</TabPanel>

      <TabPanel id="staff" tabs={TABS}>{<PeopleList title="Staff" people={staff} canManage={canManage} assignable={canAssign} viewerId={viewer.id} />}</TabPanel>
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
                    <SearchSelect
                      name="role"
                      defaultValue={p.role}
                      aria-label={`Role for ${p.name || p.email}`}
                      className={`${inputWidth("w-36")} h-8`}
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </SearchSelect>
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
