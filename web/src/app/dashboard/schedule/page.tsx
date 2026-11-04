import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { formatDateTime, hoursAgoIso, todayIn } from "@/lib/format";
import { MANAGER_ROLES } from "@/lib/roles";
import { PT_STATUS, dayLabel, endTime, hhmm, nextDays, weekdayOf } from "@/lib/schedule";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { updatePtSession } from "@/app/schedule-actions";
import { ActionButton } from "../members/action-button";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { SessionModal } from "./session-modal";
import { Timetable } from "./timetable";

export const metadata: Metadata = { title: "Schedule" };

const TABS = ["week", "pt", "timetable"] as const;
const BASE = "/dashboard/schedule";

export default function SchedulePage({ searchParams }: PageProps<"/dashboard/schedule">) {
  return (
    <div className="max-w-6xl space-y-6">
      <Suspense fallback={<Skeleton className="h-10 w-64" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <ScheduleContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  await requireStaff();
  return (
    <PageHeader
      title="Schedule"
      description="Classes for the next 7 days and personal training sessions."
    />
  );
}

async function ScheduleContent({ searchParams }: { searchParams: PageProps<"/dashboard/schedule">["searchParams"] }) {
  const query = await searchParams;
  const { viewer, membership } = await requireStaff();
  const tabs = TABS.filter((t) => t !== "timetable" || MANAGER_ROLES.includes(membership.role));
  const tab = activeTab(query.tab, tabs);
  const tz = membership.timezone;
  const today = todayIn(tz);
  const days = nextDays(today, 7);
  const isManager = MANAGER_ROLES.includes(membership.role);
  const supabase = await createClient();

  let ptQuery = supabase
    .from("pt_sessions")
    .select("id, starts_at, duration_min, status, note, trainer_id, member_id, members(full_name), trainer:profiles!pt_sessions_trainer_id_fkey(full_name)")
    .eq("gym_id", membership.gymId)
    .in("status", ["requested", "confirmed"])
    .gte("starts_at", hoursAgoIso(2))
    .order("starts_at")
    .limit(50);
  // Trainers see their own sessions; owners and managers see everyone's.
  if (!isManager) ptQuery = ptQuery.eq("trainer_id", viewer.id);

  const [{ data: classes }, { data: bookings }, { data: pt }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, weekday, start_time, duration_min, capacity, location, trainer:profiles(full_name)")
      .eq("gym_id", membership.gymId)
      .eq("is_active", true)
      .order("start_time"),
    supabase
      .from("class_bookings")
      .select("class_id, session_date, status")
      .eq("gym_id", membership.gymId)
      .gte("session_date", days[0])
      .lte("session_date", days[6])
      .in("status", ["booked", "waitlist", "attended"]),
    ptQuery,
  ]);

  const count = (classId: string, date: string, statuses: string[]) =>
    (bookings ?? []).filter((b) => b.class_id === classId && b.session_date === date && statuses.includes(b.status)).length;
  const requests = (pt ?? []).filter((s) => s.status === "requested");
  const confirmed = (pt ?? []).filter((s) => s.status === "confirmed");

  return (
    <div className="space-y-6">
      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={tabs.map((t) => ({
          id: t,
          label: { week: "This week", pt: "Personal training", timetable: "Timetable" }[t],
          count: t === "pt" ? requests.length : undefined,
        }))}
      />
      {typeof query.session === "string" && <SessionModal session={query.session} membership={membership} />}
      {tabs.includes("timetable") && <TabPanel id="timetable" tabs={tabs}><Timetable /></TabPanel>}
      <TabPanel id="week" tabs={tabs}>{(
      <div className="space-y-4">
        {!classes?.length && (
          <Card className="p-6 text-sm text-muted">
            No classes on the timetable yet.{isManager && " Use “Edit timetable” to add your weekly classes."}
          </Card>
        )}
        {days.map((date) => {
          const todays = (classes ?? []).filter((c) => c.weekday === weekdayOf(date));
          if (!todays.length) return null;
          return (
            <Card key={date}>
              <SectionTitle>{dayLabel(date, today)}</SectionTitle>
              <ul className="divide-y divide-line border-t border-line">
                {todays.map((c) => {
                  const booked = count(c.id, date, ["booked", "attended"]);
                  const waiting = count(c.id, date, ["waitlist"]);
                  const full = booked >= c.capacity;
                  return (
                    <li key={c.id}>
                      <Link href={`${BASE}?tab=week&session=${c.id}_${date}`} scroll={false} className="flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-canvas/50">
                        <span className="w-24 text-sm font-semibold tabular-nums">
                          {hhmm(c.start_time)}–{endTime(c.start_time, c.duration_min)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{c.name}</span>
                          <span className="block text-xs text-muted">
                            {[c.trainer?.full_name, c.location].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                        <span className="text-sm tabular-nums">
                          {booked}/{c.capacity}
                        </span>
                        {full ? <Badge tone="red">Full</Badge> : <Badge tone="green">{c.capacity - booked} left</Badge>}
                        {waiting > 0 && <Badge tone="amber">{waiting} waiting</Badge>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      )}</TabPanel>

      <TabPanel id="pt" tabs={tabs}>{(
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>PT requests</SectionTitle>
          {!requests.length ? (
            <EmptyState>No requests waiting.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {requests.map((s) => (
                <li key={s.id} className="space-y-2 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/dashboard/members/${s.member_id}`} className="font-medium hover:underline">
                      {s.members?.full_name}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatDateTime(s.starts_at, tz)} · {s.duration_min} min
                      {isManager && s.trainer?.full_name ? ` · with ${s.trainer.full_name}` : ""}
                    </p>
                    {s.note && <p className="text-xs">“{s.note}”</p>}
                  </div>
                  {(s.trainer_id === viewer.id || isManager) && (
                    <div className="flex gap-2">
                      <ActionButton action={updatePtSession.bind(null, s.id, "confirm")} label="Confirm" variant="primary" className="h-8 px-3" />
                      <ActionButton action={updatePtSession.bind(null, s.id, "decline")} label="Decline" variant="ghost" className="h-8 px-3" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Upcoming PT sessions</SectionTitle>
          {!confirmed.length ? (
            <EmptyState>Nothing booked. Book sessions from a member&apos;s page.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {confirmed.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/dashboard/members/${s.member_id}`} className="font-medium hover:underline">
                      {s.members?.full_name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {formatDateTime(s.starts_at, tz)} · {s.duration_min} min
                      {isManager && s.trainer?.full_name ? ` · ${s.trainer.full_name}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge tone={PT_STATUS.confirmed.tone}>{PT_STATUS.confirmed.label}</Badge>
                    {(s.trainer_id === viewer.id || isManager) && new Date(s.starts_at) < new Date() && (
                      <ActionButton action={updatePtSession.bind(null, s.id, "done")} label="Done" variant="ghost" className="h-8 px-2" />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}</TabPanel>
    </div>
  );
}
