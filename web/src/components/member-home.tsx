import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Dumbbell, Flame, Nfc, UserRound, Lock } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { ActionButton } from "@/app/dashboard/members/action-button";
import { freezeMyMembership } from "@/app/portal/actions";
import { TodayWorkout } from "@/components/today-workout";
import {
  INVOICE_STATUS,
  addDays,
  MEMBER_STATUS,
  daysBetween,
  formatDate,
  formatDateTime,
  formatUSD,
  todayIn,
  type InvoiceStatus,
  type MemberStatus,
} from "@/lib/format";
import { WEEKDAYS, hhmm, weekdayOf } from "@/lib/schedule";
import { loadTrainingPlan } from "@/lib/training-plan";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Monday-first week strip.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// The member app's home screen for one member: what to do today, how the week
// is going, the membership, what's next and what happened lately. Used by the
// real app and by staff's read-only "View as member" preview, so both match.
export async function MemberHome({
  supabase,
  memberId,
  gymName,
  timeZone,
  preview = false,
  locked = false,
  canPause = false,
}: {
  supabase: Client;
  memberId: string;
  gymName: string;
  timeZone: string;
  preview?: boolean;
  // Membership not active (or frozen for an unpaid balance): training parts are blurred out.
  locked?: boolean;
  // Members may pause their own membership (a feature switch).
  canPause?: boolean;
}) {
  const dim = locked ? "pointer-events-none select-none opacity-40 grayscale blur-[1.5px]" : "";
  const today = todayIn(timeZone);
  const nowIso = new Date().toISOString();
  const [{ data: me }, { data: invoices }, { data: visits }, { data: nextClass }, { data: nextPt }, { data: workouts }, plan] = await Promise.all([
    supabase.from("member_overview").select("*").eq("id", memberId).maybeSingle(),
    supabase.from("invoice_summary").select("*").eq("member_id", memberId).neq("status", "void").order("number", { ascending: false }).limit(6),
    supabase.from("checkins").select("id, allowed, reason, checked_in_at").eq("member_id", memberId).order("checked_in_at", { ascending: false }).limit(5),
    supabase
      .from("class_bookings")
      .select("session_date, status, classes(name, start_time, location)")
      .eq("member_id", memberId)
      .in("status", ["booked", "waitlist"])
      .gte("session_date", today)
      .order("session_date")
      .limit(5),
    supabase
      .from("pt_sessions")
      .select("starts_at, status")
      .eq("member_id", memberId)
      .in("status", ["requested", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, day_name, started_at, set_logs(count)")
      .eq("member_id", memberId)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5),
    loadTrainingPlan(supabase, memberId, timeZone),
  ]);

  const firstName = me?.full_name?.split(" ")[0];
  const status = MEMBER_STATUS[(me?.status ?? "none") as MemberStatus];
  const daysLeft = me?.status === "active" && me.ends_on ? daysBetween(today, me.ends_on) : null;
  const balance = Number(me?.balance_usd ?? 0);
  const active = me?.status === "active";
  const trainingDays = new Set(plan.days.map((d) => d.weekday));
  const todayDow = weekdayOf(today);

  // The next class (soonest booking today or later, today's only if still ahead).
  const upcomingClass = (nextClass ?? [])
    .filter((b) => b.classes)
    .map((b) => ({ ...b, at: `${b.session_date}T${hhmm(b.classes!.start_time)}` }))
    .sort((a, b) => a.at.localeCompare(b.at))[0];

  // Recent activity: check-ins and finished workouts, newest first.
  const activity = [
    ...(visits ?? []).map((v) => ({
      at: v.checked_in_at,
      key: `c${v.id}`,
      icon: <Nfc className="size-4" />,
      text: v.allowed ? "Checked in" : `Check-in refused: ${v.reason ?? ""}`,
      ok: v.allowed,
    })),
    ...(workouts ?? []).map((w) => ({
      at: w.started_at,
      key: `w${w.id}`,
      icon: <Dumbbell className="size-4" />,
      text: `${w.day_name ?? "Workout"} · ${w.set_logs[0]?.count ?? 0} sets`,
      ok: true,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <div className="stagger space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{gymName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hi{firstName ? ` ${firstName}` : ""}</h1>
        </div>
        {!preview && (
          <Link href="/portal/profile" aria-label="My profile" className="grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line transition hover:ring-ink/30">
            <UserRound className="size-5" />
          </Link>
        )}
      </div>

      {balance > 0 && (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">You have {formatUSD(balance)} to pay at the front desk.</p>
      )}

      <div className="relative">
        <div className={dim} aria-hidden={locked || undefined} inert={locked || undefined}>
          <TodayWorkout plan={plan} weekdayName={WEEKDAYS[todayDow]} preview={preview} />
        </div>
        {locked && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-line">
              <Lock className="size-4" /> Opens with an active membership
            </span>
          </div>
        )}
      </div>

      {/* This week */}
      <Card className={`p-5 ${dim}`} aria-hidden={locked || undefined} inert={locked || undefined}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">This week</p>
            <p className="text-xl font-semibold tabular-nums">
              {plan.doneThisWeek} of {plan.goal} workouts
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold">
            <Flame className={`size-4 ${plan.streak ? "text-orange-500" : "text-muted"}`} />
            {plan.streak} week{plan.streak === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.min(100, (plan.doneThisWeek / plan.goal) * 100)}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
          {WEEK.map((d) => (
            <div key={d} className="space-y-1">
              <span className={`block ${d === todayDow ? "font-semibold text-ink" : "text-muted"}`}>{WEEKDAYS[d].slice(0, 1)}</span>
              <span className={`mx-auto block size-2 rounded-full ${trainingDays.has(d) ? "bg-ink" : "bg-line"}`} />
            </div>
          ))}
        </div>
        {!preview && (
          <Link href="/portal/profile#training-days" className="mt-4 flex items-center justify-between text-sm text-muted hover:text-ink">
            {plan.days.length ? "Change my training days" : "Set my training days and weekly goal"}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </Card>

      {/* Membership */}
      <Card className="overflow-hidden">
        <div className={`p-5 ${active ? "bg-surface" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Membership</p>
              <p className="text-lg font-semibold">{me?.plan_name ?? "No membership yet"}</p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {me?.ends_on && (
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted">{me.status === "expired" ? "Ended" : "Valid until"}</p>
                <p className="font-medium">{formatDate(me.ends_on)}</p>
              </div>
              {daysLeft !== null && (
                <div>
                  <p className="text-xs text-muted">Days left</p>
                  <p className="font-semibold tabular-nums">{daysLeft}</p>
                </div>
              )}
              {me.visit_limit && (
                <div>
                  <p className="text-xs text-muted">Visits left</p>
                  <p className="font-medium">
                    {Math.max(me.visit_limit - (me.visits_used ?? 0), 0)} of {me.visit_limit}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {!preview && canPause && me?.status === "active" && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-sm text-muted">Away for a while? Pause it and the days are added back.</p>
            <ActionButton
              action={freezeMyMembership.bind(null, "freeze")}
              label="Pause"
              pendingLabel="Pausing…"
              confirm="Pause your membership? You can't check in or use the app until you resume it. The paused days are added to your end date."
            />
          </div>
        )}
        {!preview && canPause && me?.status === "frozen" && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-sm text-muted">Your membership is paused.</p>
            <ActionButton action={freezeMyMembership.bind(null, "unfreeze")} label="Resume" pendingLabel="Resuming…" variant="primary" />
          </div>
        )}
        {(!me || me.status === "expired" || me.status === "none") && (
          <p className="border-t border-line px-5 py-3 text-sm text-muted">Renew at the front desk to keep training.</p>
        )}
      </Card>

      {/* Next up */}
      <Card className={dim} aria-hidden={locked || undefined} inert={locked || undefined}>
        <SectionTitle>Next up</SectionTitle>
        <ul className="divide-y divide-line border-t border-line text-sm">
          {upcomingClass && (
            <li className="flex items-center gap-3 px-5 py-3">
              <CalendarDays className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{upcomingClass.classes!.name}</span>
                <span className="block text-xs text-muted">
                  {upcomingClass.session_date === today ? "Today" : upcomingClass.session_date === addDays(today, 1) ? "Tomorrow" : formatDate(upcomingClass.session_date)} at{" "}
                  {hhmm(upcomingClass.classes!.start_time)}
                  {upcomingClass.classes!.location ? ` · ${upcomingClass.classes!.location}` : ""}
                </span>
              </span>
              <Badge tone={upcomingClass.status === "booked" ? "green" : "amber"}>{upcomingClass.status === "booked" ? "Booked" : "Waitlist"}</Badge>
            </li>
          )}
          {nextPt && (
            <li className="flex items-center gap-3 px-5 py-3">
              <Dumbbell className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Personal training</span>
                <span className="block text-xs text-muted">{formatDateTime(nextPt.starts_at, timeZone)}</span>
              </span>
              <Badge tone={nextPt.status === "confirmed" ? "green" : "amber"}>{nextPt.status === "confirmed" ? "Confirmed" : "Requested"}</Badge>
            </li>
          )}
          {!upcomingClass && !nextPt && (
            <li className="px-5 py-4 text-muted">
              Nothing booked.{" "}
              {!preview && (
                <Link href="/portal/schedule" className="font-medium text-ink underline underline-offset-4">
                  See classes
                </Link>
              )}
            </li>
          )}
        </ul>
      </Card>

      {/* Recent activity */}
      <Card>
        <SectionTitle>Recent activity</SectionTitle>
        {!activity.length ? (
          <EmptyState>Nothing yet. Tap the sticker at the entrance to check in.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {activity.map((a) => (
              <li key={a.key} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${a.ok ? "bg-canvas" : "bg-danger-soft text-danger"}`}>{a.icon}</span>
                <span className="min-w-0 flex-1 truncate">{a.text}</span>
                <span className="text-xs text-muted">{formatDateTime(a.at, timeZone)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Invoices</SectionTitle>
        {!invoices?.length ? (
          <EmptyState>No invoices yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {invoices.map((inv) => {
              const s = INVOICE_STATUS[inv.status as InvoiceStatus];
              return (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{inv.description}</span>
                    <span className="block text-xs text-muted">
                      #{String(inv.number).padStart(4, "0")} · {formatDate(inv.issued_on)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums">{formatUSD(inv.total_usd)}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {!preview && (
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted">
          <CheckCircle2 className="size-3.5" /> Tap the Gymix sticker at the entrance to check in.
        </p>
      )}
    </div>
  );
}
