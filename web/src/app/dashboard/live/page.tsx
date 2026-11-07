import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Dialog } from "@/components/dialog";
import { BusyHeatmap, TodayChart } from "@/components/occupancy-charts";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { LEVELS, METHOD_TEXT, gymClock, loadOccupancy, usualText } from "@/lib/occupancy";
import { requestOrigin } from "@/lib/origin";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ago } from "../access/shared";
import { CopyField } from "../access/forms";
import { addSensor, deleteSensor, saveOccupancySettings } from "./actions";
import { OccupancySettingsForm, SensorForm } from "./forms";

export const metadata: Metadata = { title: "Live" };

export default function LivePage() {
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Live" description="Who's in the gym right now, and when it's usually busy." />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <LiveContent />
      </Suspense>
    </div>
  );
}

async function LiveContent() {
  const { membership } = await requireStaff(BILLING_ROLES);
  if (!(await hasFeature(membership.gymId, "live_occupancy"))) redirect("/dashboard");
  const data = await loadOccupancy(membership.gymId, true);
  if (!data) redirect("/dashboard");
  const { now, busy, today } = data;
  const clock = gymClock(membership.timezone);
  const level = LEVELS[now.level];
  const usualToday = Object.fromEntries(busy.filter((b) => b.weekday === clock.weekday).map((b) => [b.hour, b.people]));
  const pct = now.capacity ? Math.min(100, Math.round((now.people / now.capacity) * 100)) : null;
  const canManage = MANAGER_ROLES.includes(membership.role);

  return (
    <>
      <AutoRefresh seconds={30} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-muted">In the gym now</p>
            <Badge tone={level.tone}>{level.label}</Badge>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight tabular-nums">{now.people}</span>
            <span className="text-lg text-muted">{now.capacity ? `of ${now.capacity}` : now.people === 1 ? "person" : "people"}</span>
          </p>
          {pct !== null && (
            <div className="mt-4">
              <div className="h-2.5 overflow-hidden rounded-full bg-canvas" role="meter" aria-valuenow={now.people} aria-valuemin={0} aria-valuemax={now.capacity ?? 0} aria-label="Capacity used">
                <div className={`h-full rounded-full transition-all duration-700 ${pct >= 95 ? "bg-danger" : pct >= 70 ? "bg-amber-500" : "bg-brand-strong"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">{pct}% of capacity</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            {METHOD_TEXT[now.method]}
            {now.usualNow !== null && ` Usually ${usualText(now.usualNow)} at this hour.`}
          </p>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted">Entries today</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{now.entriesToday}</p>
            <p className="mt-1 text-xs text-muted">at your doors</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Exits today</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{now.exitsToday}</p>
            <p className="mt-1 text-xs text-muted">{now.exitsToday ? "at your doors" : "add an exit reader to count them"}</p>
          </Card>
          <Card className="col-span-2 p-5">
            <p className="text-sm text-muted">Usually at this hour</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{now.usualNow === null ? "–" : now.usualNow < 0.5 ? "0" : Math.round(now.usualNow)}</p>
            <p className="mt-1 text-xs text-muted">{now.usualNow !== null && now.usualNow > 0 && now.usualNow < 0.5 ? "almost nobody, " : ""}average of the last 8 weeks</p>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Today</h2>
        <p className="mb-4 text-sm text-muted">People inside each hour. The grey line is the usual for a {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][clock.weekday]}.</p>
        <TodayChart today={today} usual={usualToday} nowHour={clock.hour} />
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Busy hours</h2>
        <p className="mb-4 text-sm text-muted">The usual number of people by day and hour, from the last 8 weeks. Members see this in their app.</p>
        <BusyHeatmap cells={busy} nowDay={clock.weekday} nowHour={clock.hour} />
      </Card>

      {canManage && (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ManagePanel gymId={membership.gymId} capacity={now.capacity} />
        </Suspense>
      )}
    </>
  );
}

async function ManagePanel({ gymId, capacity }: { gymId: string; capacity: number | null }) {
  const supabase = await createClient();
  const [{ data: gym }, { data: sensors }] = await Promise.all([
    supabase.from("gyms").select("avg_visit_minutes").eq("id", gymId).single(),
    supabase.from("occupancy_sensors").select("id, name, token, last_reading_at").eq("gym_id", gymId).order("created_at"),
  ]);
  const origin = await requestOrigin();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Settings</h2>
        <OccupancySettingsForm action={saveOccupancySettings} capacity={capacity} visit={gym?.avg_visit_minutes ?? 75} />
      </Card>
      <Card>
        <SectionTitle
          action={
            <Dialog label="Add counter" icon={<Plus className="size-4" />} variant="secondary" triggerClassName="h-9" title="Add a people counter" description="A sensor or camera at the entrance that counts people in and out.">
              <SensorForm action={addSensor} />
            </Dialog>
          }
        >
          People counters
        </SectionTitle>
        {!sensors?.length ? (
          <EmptyState>Optional. Without one, Gymix counts from your doors and check-ins. With one, the number is exact.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {sensors.map((s) => (
              <li key={s.id} className="space-y-2 px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="size-4 text-muted" />
                    {s.name}
                    <span className="font-normal text-muted">· last count {ago(s.last_reading_at)}</span>
                  </span>
                  <RowMenu label={`Actions for ${s.name}`} items={[{ kind: "action", label: "Remove", danger: true, action: deleteSensor.bind(null, s.id), confirm: `Remove ${s.name}? It stops counting.` }]} />
                </div>
                <CopyField label={`Address for ${s.name}`} value={`${origin}/api/occupancy/${s.token}`} secret />
              </li>
            ))}
          </ul>
        )}
        <details className="border-t border-line px-5 py-3 text-sm">
          <summary className="cursor-pointer font-medium">How to connect a counter</summary>
          <div className="mt-2 space-y-2 text-muted">
            <p>
              <b className="text-ink">Hikvision people-counting camera:</b> in its web page, Event → HTTP Listening, add the counter&apos;s address (HTTPS, port 443) and turn on people counting upload. Gymix reads its in/out totals.
            </p>
            <p>
              <b className="text-ink">Any other counter:</b> have it send a POST with JSON to the address, either the number inside, <code className="rounded bg-canvas px-1">{'{"people": 23}'}</code>, or what changed since its last message, <code className="rounded bg-canvas px-1">{'{"in": 3, "out": 1}'}</code>.
            </p>
          </div>
        </details>
      </Card>
    </div>
  );
}
