import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton, buttonClass, inputClass } from "@/components/ui";
import { MEMBER_STATUS, formatDate, formatUSD, type MemberStatus } from "@/lib/format";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "frozen", label: "Frozen" },
  { value: "none", label: "No membership" },
  { value: "owing", label: "Owing money" },
];

export default function MembersPage({ searchParams }: PageProps<"/dashboard/members">) {
  return (
    <div className="max-w-6xl space-y-6">
      <Suspense fallback={<Skeleton className="h-10 w-64" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <MemberList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const { membership } = await requireStaff();
  return (
    <PageHeader
      title="Members"
      description="Everyone with a membership at your gym — with or without a portal account."
      action={
        BILLING_ROLES.includes(membership.role) && (
          <Link href="/dashboard/members/new" className={buttonClass("primary")}>
            <Plus className="size-4" /> Add member
          </Link>
        )
      }
    />
  );
}

async function MemberList({ searchParams }: { searchParams: PageProps<"/dashboard/members">["searchParams"] }) {
  const { membership } = await requireStaff();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const showMoney = BILLING_ROLES.includes(membership.role);

  const supabase = await createClient();
  let query = supabase
    .from("member_overview")
    .select("id, full_name, phone, email, user_id, plan_name, ends_on, status, balance_usd, last_checkin_at")
    .eq("gym_id", membership.gymId)
    .order("full_name")
    .limit(300);

  // Strip characters PostgREST uses as filter syntax.
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  if (status === "owing") query = query.gt("balance_usd", 0);
  else if (status === "expired") query = query.in("status", ["expired", "used_up"]);
  else if (status) query = query.eq("status", status);

  const { data: members } = await query;

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-3" role="search">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone or email"
            aria-label="Search members"
            className={`${inputClass} pl-9`}
          />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => showMoney || f.value !== "owing").map((f) => {
          const href = `/dashboard/members?${new URLSearchParams({ ...(q ? { q } : {}), ...(f.value ? { status: f.value } : {}) })}`;
          const active = status === f.value;
          return (
            <Link
              key={f.value}
              href={href}
              className={`rounded-full border px-3 py-1 text-sm ${
                active ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {!members?.length ? (
          <EmptyState>
            <span className="block pt-5">
              {q || status ? "No members match this search." : "No members yet. Add your first member to get started."}
            </span>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Membership</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Last visit</th>
                  {showMoney && <th className="px-5 py-3 text-right font-medium">Owes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => {
                  const s = MEMBER_STATUS[(m.status ?? "none") as MemberStatus];
                  return (
                    <tr key={m.id} className="hover:bg-canvas/50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/members/${m.id}`} className="font-medium hover:underline">
                          {m.full_name}
                        </Link>
                        <p className="text-xs text-muted">{m.phone || m.email || "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        {m.plan_name ? (
                          <>
                            <p>{m.plan_name}</p>
                            <p className="text-xs text-muted">until {formatDate(m.ends_on)}</p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="hidden px-5 py-3 text-muted md:table-cell">
                        {m.last_checkin_at ? formatDate(m.last_checkin_at) : "Never"}
                      </td>
                      {showMoney && (
                        <td className={`px-5 py-3 text-right tabular-nums ${Number(m.balance_usd) > 0 ? "font-medium text-danger" : "text-muted"}`}>
                          {Number(m.balance_usd) > 0 ? formatUSD(m.balance_usd) : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
