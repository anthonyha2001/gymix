import type { Metadata } from "next";
import { TrendChart } from "@/components/trend-chart";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { MeasurementsPanel } from "@/components/measurements-panel";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { Alert, Card, EmptyState, Skeleton } from "@/components/ui";
import { WorkoutModal } from "@/components/workout-modal";
import { WeeklyChart } from "@/components/weekly-chart";
import { loadWeeklyBars } from "@/lib/weekly";
import { formatKg } from "@/lib/exercises";
import { formatDate, formatDateTime, hoursAgoIso } from "@/lib/format";
import { requirePortalPage } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Progress" };

const TABS = ["workouts", "records", "body"] as const;
const BASE = "/portal/progress";

export default function ProgressPage({ searchParams }: PageProps<"/portal/progress">) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Progress searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Progress({ searchParams }: { searchParams: PageProps<"/portal/progress">["searchParams"] }) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const { viewer, membership } = await requirePortalPage("progress");
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet.</Card>;

  const [{ data: sessions }, { data: bests }, weeks, { data: history }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, day_name, started_at, finished_at, set_logs(weight_kg, reps)")
      .eq("member_id", me.id)
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("exercise_bests")
      .select("exercise_id, best_weight_kg, best_bodyweight_reps, best_est_1rm_kg, last_logged_at, sessions, exercises(name)")
      .eq("member_id", me.id)
      .order("last_logged_at", { ascending: false })
      .limit(30),
    loadWeeklyBars(supabase, me.id, membership.timezone, 12),
    // Every logged set of the last six months, for the per-exercise charts.
    supabase
      .from("set_logs")
      .select("exercise_id, weight_kg, reps, logged_at")
      .eq("member_id", me.id)
      .gt("reps", 0)
      .gte("logged_at", hoursAgoIso(183 * 24))
      .order("logged_at")
      .limit(3000),
  ]);

  // Best weight per day, per exercise.
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: membership.timezone });
  const progressByExercise = new Map<string, Map<string, number>>();
  for (const l of history ?? []) {
    const byDay = progressByExercise.get(l.exercise_id) ?? new Map<string, number>();
    const day = dayOf.format(new Date(l.logged_at));
    byDay.set(day, Math.max(byDay.get(day) ?? 0, Number(l.weight_kg)));
    progressByExercise.set(l.exercise_id, byDay);
  }
  const pointsFor = (exerciseId: string) =>
    [...(progressByExercise.get(exerciseId) ?? new Map())].map(([date, value]) => ({ date, value })).filter((p) => p.value > 0);

  const doneSession = typeof query.done === "string" ? sessions?.find((s) => s.id === query.done) : undefined;
  const now = new Date();
  const thisMonth = (sessions ?? []).filter(
    (s) => s.finished_at && new Date(s.started_at).getMonth() === now.getMonth() && new Date(s.started_at).getFullYear() === now.getFullYear(),
  ).length;

  return (
    <div className="space-y-5">
      {doneSession && (
        <Alert tone="success">
          Workout saved: {doneSession.set_logs.length} set{doneSession.set_logs.length === 1 ? "" : "s"},{" "}
          {Math.round(doneSession.set_logs.reduce((t, s) => t + Number(s.weight_kg) * s.reps, 0)).toLocaleString()} kg lifted.
        </Alert>
      )}

      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={[
          { id: "workouts", label: "Workouts" },
          { id: "records", label: "Records" },
          { id: "body", label: "Body" },
        ]}
      />

      {typeof query.workout === "string" && <WorkoutModal sessionId={query.workout} memberId={me.id} timeZone={membership.timezone} />}

      <TabPanel id="workouts" tabs={TABS}>{(
        <>
          <Card className="p-5">
            <WeeklyChart weeks={weeks} />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted">Workouts this month</p>
              <p className="text-2xl font-semibold tabular-nums">{thisMonth}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Exercises tracked</p>
              <p className="text-2xl font-semibold tabular-nums">{bests?.length ?? 0}</p>
            </Card>
          </div>
          <Card>
            {!sessions?.length ? (
              <EmptyState>No workouts yet. Start one from the Train tab.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {sessions.map((s) => {
                  const volume = s.set_logs.reduce((t, l) => t + Number(l.weight_kg) * l.reps, 0);
                  const minutes = s.finished_at ? Math.round((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 60000) : null;
                  return (
                    <li key={s.id}>
                      <HoverLink
                        href={`${BASE}?tab=workouts&workout=${s.id}`}
                        scroll={false}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-canvas/50"
                      >
                        <span>
                          <span className="block font-medium">{s.day_name ?? "Workout"}</span>
                          <span className="block text-xs text-muted">
                            {formatDateTime(s.started_at, membership.timezone)}
                            {minutes !== null ? ` · ${minutes} min` : " · not finished"}
                          </span>
                        </span>
                        <span className="text-right text-xs text-muted">
                          {s.set_logs.length} sets
                          <span className="block">{Math.round(volume).toLocaleString()} kg</span>
                        </span>
                      </HoverLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}</TabPanel>

      <TabPanel id="records" tabs={TABS}>{(
        <Card>
          <p className="flex items-center gap-2 px-5 pt-4 pb-2 font-semibold">
            <Trophy className="size-4 text-amber-600" /> Personal records
          </p>
          {!bests?.length ? (
            <EmptyState>Log your first workout to start tracking records.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {bests.map((b) => {
                const points = pointsFor(b.exercise_id);
                const row = (
                <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.exercises?.name ?? b.exercise_id}</span>
                    <span className="block text-xs text-muted">
                      {b.sessions} workout{b.sessions === 1 ? "" : "s"} · last {formatDate(b.last_logged_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    {Number(b.best_weight_kg) > 0 ? (
                      <>
                        <span className="block font-semibold tabular-nums">{formatKg(b.best_weight_kg)}</span>
                        <span className="block text-xs text-muted">≈ {formatKg(b.best_est_1rm_kg)} max</span>
                      </>
                    ) : (
                      <span className="font-semibold tabular-nums">{b.best_bodyweight_reps} reps</span>
                    )}
                  </span>
                </div>
                );
                return (
                  <li key={b.exercise_id}>
                    {points.length >= 2 ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none hover:bg-canvas/50 [&::-webkit-details-marker]:hidden">{row}</summary>
                        <div className="px-5 pb-4">
                          <TrendChart title="Best weight per workout" unit="kg" points={points} />
                        </div>
                      </details>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}</TabPanel>

      <TabPanel id="body" tabs={TABS}>{(
        <MeasurementsPanel supabase={supabase} memberId={me.id} viewerId={viewer.id} timeZone={membership.timezone} canRecord recordFor={null} />
      )}</TabPanel>
    </div>
  );
}
