import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Nfc } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CheckInStation } from "./station";

export const metadata: Metadata = { title: "Check-in" };

export default function CheckInPage() {
  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <PageHeader
          title="Check-in"
          description="Members tap their phone on the Gymix sticker at the entrance. Check anyone else in here."
        />
        <Suspense fallback={<Skeleton className="h-14" />}>
          <Station />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <LiveFeed />
      </Suspense>
    </div>
  );
}

async function Station() {
  await requireStaff(BILLING_ROLES);
  return <CheckInStation />;
}

async function LiveFeed() {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("checkins")
    .select("id, allowed, reason, source, checked_in_at, member_id, members(full_name)")
    .eq("gym_id", membership.gymId)
    .order("checked_in_at", { ascending: false })
    .limit(25);

  return (
    <Card className="h-fit lg:sticky lg:top-8">
      <AutoRefresh seconds={5} />
      <SectionTitle action={<span className="text-xs text-muted">Live · updates every few seconds</span>}>
        Latest check-ins
      </SectionTitle>
      {!rows?.length ? (
        <EmptyState>Nobody has checked in yet. Taps on the sticker appear here instantly.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
                {formatTime(r.checked_in_at, membership.timezone)}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/members/${r.member_id}`} className="block truncate text-sm font-medium hover:underline">
                  {r.members?.full_name ?? "Member"}
                </Link>
                {!r.allowed && <p className="truncate text-xs text-danger">{r.reason}</p>}
              </div>
              {r.source === "tap" && (
                <span title="Tapped the sticker" className="text-muted">
                  <Nfc className="size-4" />
                </span>
              )}
              {r.allowed ? <Badge tone="green">In</Badge> : <Badge tone="red">Denied</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
