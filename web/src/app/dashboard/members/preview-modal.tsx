import { Eye } from "lucide-react";
import { MeasurementsPanel } from "@/components/measurements-panel";
import { MemberHome } from "@/components/member-home";
import { ProgramCard } from "@/components/program-card";
import { RouteModal } from "@/components/route-modal";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { loadExerciseStats } from "@/lib/exercise-stats";
import { formatDateTime, todayIn } from "@/lib/format";
import { loadActivePrograms } from "@/lib/programs";
import { BOOKING_STATUS, PT_STATUS, dayLabel, hhmm } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

// Staff preview of what this member sees in their app (?preview=<member id>).
// Read-only: nothing here acts on the member's behalf. (Chats stay private.)
export async function MemberPreviewModal({
  memberId: id,
  viewerId,
  membership,
}: {
  memberId: string;
  viewerId: string;
  membership: { gymId: string; gymName: string; timezone: string };
}) {
  const viewer = { id: viewerId };
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("id, full_name, user_id").eq("id", id).eq("gym_id", membership.gymId).maybeSingle();
  if (!member) return null;

  const tz = membership.timezone;
  const today = todayIn(tz);
  const [programs, { data: bookings }, { data: pt }, { data: sessions }, { data: classes }, { data: coaches }] = await Promise.all([
    loadActivePrograms(supabase, id),
    supabase.from("class_bookings").select("id, class_id, session_date, status").eq("member_id", id).gte("session_date", today).neq("status", "cancelled").order("session_date"),
    supabase.from("pt_sessions").select("id, starts_at, duration_min, status, trainer_id").eq("member_id", id).in("status", ["requested", "confirmed"]).order("starts_at"),
    supabase.from("workout_sessions").select("id, day_name, started_at, finished_at, set_logs(weight_kg, reps)").eq("member_id", id).order("started_at", { ascending: false }).limit(10),
    supabase.from("classes").select("id, name, start_time").eq("gym_id", membership.gymId),
    supabase.rpc("gym_coaches", { p_gym_id: membership.gymId }),
  ]);
  const stats = await loadExerciseStats(
    supabase,
    id,
    programs.flatMap((p) => p.days.flatMap((d) => d.exercises.map((e) => e.exercise.id))),
  );

  return (
    <RouteModal param="preview" title={`${member.full_name} as a member`} size="xl">
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <Eye className="size-4 shrink-0" />
        Read-only preview of what {member.full_name} sees{!member.user_id && " (they haven't joined the member app yet)"}.
      </p>

      {/* The portal itself, at phone-ish width. */}
      <div className="mx-auto max-w-3xl space-y-10">
        <section id="home" className="scroll-mt-32">
          <MemberHome supabase={supabase} memberId={id} gymName={membership.gymName} timeZone={tz} preview />
        </section>

        <section id="program" className="scroll-mt-32 space-y-4">
          <h2 className="text-xl font-semibold">My program</h2>
          {!programs.length ? (
            <Card className="p-6 text-sm text-muted">No active program.</Card>
          ) : (
            programs.map((p) => <ProgramCard key={p.id} program={p} stats={stats} readOnly />)
          )}
        </section>

        <section id="schedule" className="scroll-mt-32 space-y-4">
          <h2 className="text-xl font-semibold">Schedule</h2>
          <Card>
            <SectionTitle>Booked classes</SectionTitle>
            {!bookings?.length ? (
              <EmptyState>No upcoming classes.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {bookings.map((b) => {
                  const c = classes?.find((x) => x.id === b.class_id);
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span>
                        {c?.name ?? "Class"}
                        <span className="block text-xs text-muted">
                          {dayLabel(b.session_date, today)}
                          {c ? ` · ${hhmm(c.start_time)}` : ""}
                        </span>
                      </span>
                      <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <SectionTitle>Personal training</SectionTitle>
            {!pt?.length ? (
              <EmptyState>No sessions booked.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {pt.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>
                      With {coaches?.find((c) => c.id === s.trainer_id)?.full_name ?? "trainer"}
                      <span className="block text-xs text-muted">
                        {formatDateTime(s.starts_at, tz)} · {s.duration_min} min
                      </span>
                    </span>
                    <Badge tone={PT_STATUS[s.status].tone}>{PT_STATUS[s.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section id="progress" className="scroll-mt-32 space-y-4">
          <h2 className="text-xl font-semibold">Progress</h2>
          <MeasurementsPanel supabase={supabase} memberId={id} viewerId={viewer.id} timeZone={tz} canRecord={false} recordFor={null} />
        </section>

        <section id="workouts" className="scroll-mt-32 space-y-4">
          <h2 className="text-xl font-semibold">Workouts</h2>
          <Card>
            {!sessions?.length ? (
              <EmptyState>
                <span className="block pt-5">No workouts logged yet.</span>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      {s.day_name ?? "Workout"}
                      <span className="block text-xs text-muted">{formatDateTime(s.started_at, tz)}</span>
                    </span>
                    <span className="text-right text-xs text-muted">
                      {s.set_logs.length} sets
                      <span className="block">
                        {Math.round(s.set_logs.reduce((t, l) => t + Number(l.weight_kg) * l.reps, 0)).toLocaleString()} kg
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
    </RouteModal>
  );
}
