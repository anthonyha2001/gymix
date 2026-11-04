import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Dialog } from "@/components/dialog";
import { PtSessionForm } from "@/components/schedule-forms";
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { addDays, formatDate, formatDateTime, formatUSD, hoursAgoIso, todayIn } from "@/lib/format";
import { BOOKING_STATUS, PT_STATUS, WEEKDAYS, dayLabel, endTime, hhmm, nextDays, weekdayOf } from "@/lib/schedule";
import { requirePortalPage } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { bookClass, cancelBooking, requestPtSession, subscribeToCourse, updatePtSession } from "@/app/schedule-actions";
import { ActionButton } from "../../dashboard/members/action-button";
import { activeTab, PageTabs } from "@/components/page-tabs";

export const metadata: Metadata = { title: "Schedule" };

const TABS = ["classes", "courses", "pt"] as const;

export default function MemberSchedulePage({ searchParams }: PageProps<"/portal/schedule">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <MemberSchedule searchParams={searchParams} />
    </Suspense>
  );
}

async function MemberSchedule({ searchParams }: { searchParams: PageProps<"/portal/schedule">["searchParams"] }) {
  const tab = activeTab((await searchParams).tab, TABS);
  const { viewer, membership } = await requirePortalPage("schedule");
  const tz = membership.timezone;
  const today = todayIn(tz);
  const days = nextDays(today, 7);
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();

  const [{ data: classes }, { data: counts }, { data: mine }, { data: pt }, { data: coaches }, { data: subs }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, weekday, start_time, duration_min, capacity, location, trainer_id, monthly_price_usd")
      .eq("gym_id", membership.gymId)
      .eq("is_active", true)
      .order("start_time"),
    // Spots taken per session — counts only; members can't see who booked.
    supabase.rpc("class_spots", { p_gym_id: membership.gymId, p_from: days[0], p_to: days[6] }),
    me
      ? supabase
          .from("class_bookings")
          .select("id, class_id, session_date, status")
          .eq("member_id", me.id)
          .gte("session_date", days[0])
          .neq("status", "cancelled")
      : { data: [] },
    me
      ? supabase
          .from("pt_sessions")
          .select("id, starts_at, duration_min, status, note, trainer_id")
          .eq("member_id", me.id)
          .gte("starts_at", hoursAgoIso(24))
          .order("starts_at")
      : { data: [] },
    supabase.rpc("gym_coaches", { p_gym_id: membership.gymId }),
    me
      ? supabase
          .from("class_subscriptions")
          .select("id, class_id, starts_on, ends_on, price_usd, invoice_summary(balance_usd)")
          .eq("member_id", me.id)
          .eq("status", "active")
          .gte("ends_on", today)
          .order("starts_on")
      : { data: [] },
  ]);
  const courses = (classes ?? []).filter((c) => c.monthly_price_usd !== null);
  const subFor = (classId: string) => subs?.find((s) => s.class_id === classId);

  // Members can only see staff names through gym_coaches().
  const coachName = new Map((coaches ?? []).map((c) => [c.id, c.full_name]));
  const spotsTaken = (classId: string, date: string) =>
    counts?.find((c) => c.class_id === classId && c.session_date === date)?.taken ?? 0;
  const myBooking = (classId: string, date: string) => mine?.find((b) => b.class_id === classId && b.session_date === date);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
      <PageTabs
        base="/portal/schedule"
        active={tab}
        tabs={[
          { id: "classes", label: "Classes" },
          { id: "courses", label: "Courses", count: subs?.length ?? 0 },
          { id: "pt", label: "Personal training" },
        ]}
      />

      {tab === "classes" && (
      <>
      {!classes?.length && <Card className="p-5 text-sm text-muted">Your gym hasn&apos;t published a class timetable yet.</Card>}

      {days.map((date) => {
        const todays = (classes ?? []).filter((c) => c.weekday === weekdayOf(date));
        if (!todays.length) return null;
        return (
          <Card key={date}>
            <SectionTitle>{dayLabel(date, today)}</SectionTitle>
            <ul className="divide-y divide-line border-t border-line">
              {todays.map((c) => {
                const taken = spotsTaken(c.id, date);
                const left = Math.max(c.capacity - taken, 0);
                const booking = myBooking(c.id, date);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="w-24 text-sm font-semibold tabular-nums">
                      {hhmm(c.start_time)}–{endTime(c.start_time, c.duration_min)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-muted">
                        {[c.trainer_id && coachName.get(c.trainer_id), c.location, left > 0 ? `${left} spots left` : "Full — waitlist open"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {booking ? (
                      <span className="flex items-center gap-2">
                        <Badge tone={BOOKING_STATUS[booking.status].tone}>{BOOKING_STATUS[booking.status].label}</Badge>
                        {(booking.status === "booked" || booking.status === "waitlist") && (
                          <ActionButton action={cancelBooking.bind(null, booking.id)} label="Cancel" variant="ghost" className="h-8 px-3" confirm="Cancel your spot?" />
                        )}
                      </span>
                    ) : c.monthly_price_usd !== null ? (
                      <Link href="/portal/schedule?tab=courses" scroll={false} className="text-xs font-medium underline underline-offset-4">
                        Monthly course
                      </Link>
                    ) : (
                      <ActionButton action={bookClass.bind(null, c.id, date, undefined)} label={left > 0 ? "Book" : "Join waitlist"} variant={left > 0 ? "primary" : "secondary"} className="h-8 px-3" />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      </>
      )}

      {tab === "courses" &&
        (courses.length === 0 ? (
          <Card className="p-5 text-sm text-muted">Your gym has no monthly courses yet.</Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {courses.map((c) => {
                const sub = subFor(c.id);
                const owed = Number(sub?.invoice_summary?.balance_usd ?? 0);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-muted">
                        Every {WEEKDAYS[c.weekday]} at {hhmm(c.start_time)} · {formatUSD(c.monthly_price_usd)} a month
                        {c.trainer_id && coachName.get(c.trainer_id) ? ` · ${coachName.get(c.trainer_id)}` : ""}
                      </span>
                      {sub && (
                        <span className="mt-1 block text-xs">
                          Subscribed {formatDate(sub.starts_on)} – {formatDate(sub.ends_on)}
                          {owed > 0 ? <span className="text-danger"> · {formatUSD(owed)} to pay at the front desk</span> : <span className="text-success"> · paid</span>}
                        </span>
                      )}
                    </span>
                    {sub ? (
                      <Badge tone="green">Subscribed</Badge>
                    ) : (
                      <ActionButton
                        action={subscribeToCourse.bind(null, c.id, null, null)}
                        label={`Subscribe, ${formatUSD(c.monthly_price_usd)}/month`}
                        variant="primary"
                        className="h-9"
                        confirm={`Subscribe to ${c.name} for one month? You're booked into every session, and ${formatUSD(c.monthly_price_usd)} is added to your account to pay at the front desk.`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}

      {tab === "pt" && (
      <Card>
        <SectionTitle
          action={
            <Dialog label="Request session" title="Request a PT session" description="Your trainer confirms or suggests another time." size="lg" triggerClassName="h-9">
              <PtSessionForm action={requestPtSession} coaches={coaches ?? []} defaultDate={addDays(today, 1)} submitLabel="Send request" />
            </Dialog>
          }
        >
          Personal training
        </SectionTitle>
        {!pt?.length ? (
          <EmptyState>No sessions booked.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {pt.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="block font-medium">With {coachName.get(s.trainer_id) ?? "your trainer"}</span>
                  <span className="block text-xs text-muted">
                    {formatDateTime(s.starts_at, tz)} · {s.duration_min} min
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={PT_STATUS[s.status].tone}>{PT_STATUS[s.status].label}</Badge>
                  {(s.status === "requested" || s.status === "confirmed") && (
                    <ActionButton action={updatePtSession.bind(null, s.id, "cancel")} label="Cancel" variant="ghost" className="h-8 px-3" confirm="Cancel this session?" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      )}
    </div>
  );
}
