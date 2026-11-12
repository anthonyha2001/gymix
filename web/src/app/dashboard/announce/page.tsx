import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Automations, Composer } from "./composer";

export const metadata: Metadata = { title: "Announce" };

const AUDIENCE_LABEL: Record<string, string> = {
  members: "All members",
  expiring: "Ending this week",
  inactive: "Not seen in 2 weeks",
  staff: "Your team",
  everyone: "Everyone",
};

// Messages from the gym to its members' phones (notification + push), and
// the automatic ones: win-back nudges and the nightly summary.
export default function AnnouncePage() {
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Announce" description="Send a message to your members' phones: a notification they see even with the app closed." />
      <Suspense fallback={<Skeleton className="h-[34rem]" />}>
        <Announce />
      </Suspense>
    </div>
  );
}

async function Announce() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const [{ data: history }, { data: gym }, { data: reach }] = await Promise.all([
    supabase.from("gym_announcements").select("id, audience, title, body, sent_to, created_at").eq("gym_id", membership.gymId).order("created_at", { ascending: false }).limit(20),
    supabase.from("gyms").select("winback_days, daily_summary").eq("id", membership.gymId).single(),
    supabase.rpc("announcement_reach", { p_gym_id: membership.gymId, p_audience: "members" }),
  ]);

  return (
    <div className="space-y-6">
      <Composer gymName={membership.gymName} initialReach={reach ?? 0} />

      {membership.role === "owner" && <Automations winbackDays={gym?.winback_days ?? null} dailySummary={gym?.daily_summary ?? true} />}

      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 font-semibold">Sent</h2>
        {!history?.length ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Nothing sent yet. Your announcements will show here.</p>
        ) : (
          <ul className="stagger divide-y divide-line">
            {history.map((a) => (
              <li key={a.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.title}</p>
                  {a.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.body}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {AUDIENCE_LABEL[a.audience] ?? a.audience} · {formatDateTime(a.created_at, membership.timezone)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold tabular-nums">{a.sent_to} reached</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
