import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ListPlus, Nfc, Play } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { WorkoutModal } from "@/components/workout-modal";
import { Card, Skeleton, buttonClass } from "@/components/ui";
import { loadActivePrograms } from "@/lib/programs";
import { requirePortalPage } from "@/lib/portal";
import { formatDateTime, hoursAgoIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { startFreeWorkout, startWorkout } from "../actions";

export const metadata: Metadata = { title: "Train" };

// Training hub: where a check-in tap lands. Continue the current workout or start one.
export default function TrainPage({ searchParams }: PageProps<"/portal/train">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Train searchParams={searchParams} />
    </Suspense>
  );
}

async function Train({ searchParams }: { searchParams: PageProps<"/portal/train">["searchParams"] }) {
  const { workout } = await searchParams;
  const { viewer, membership } = await requirePortalPage("train");
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id, full_name").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet. Ask the front desk.</Card>;

  const [{ data: open }, { data: recent }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, day_name, started_at, set_logs(count)")
      .eq("member_id", me.id)
      .is("finished_at", null)
      .gte("started_at", hoursAgoIso(12))
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, day_name, started_at, set_logs(count)")
      .eq("member_id", me.id)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <div className="space-y-6">
      {typeof workout === "string" && <WorkoutModal sessionId={workout} memberId={me.id} timeZone={membership.timezone} />}
      <div>
        <p className="text-sm text-muted">{membership.gymName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Ready to train, {me.full_name.split(" ")[0]}?</h1>
      </div>

      {open ? (
        <Card className="space-y-4 border-ink p-6">
          <div>
            <p className="text-sm text-muted">Workout in progress</p>
            <p className="text-xl font-semibold">{open.day_name ?? "Workout"}</p>
            <p className="text-sm text-muted">
              Started {formatDateTime(open.started_at, membership.timezone)} · {open.set_logs[0]?.count ?? 0} sets logged
            </p>
          </div>
          <Link href={`/portal/workout/${open.id}`} className={buttonClass("primary", "h-12 w-full text-base")}>
            <Play className="size-5" /> Continue workout
          </Link>
        </Card>
      ) : (
        <Card className="space-y-4 bg-ink p-6 text-white">
          <div>
            <p className="text-sm text-white/70">No workout running</p>
            <p className="text-xl font-semibold">Start today&apos;s training</p>
          </div>
          <Dialog
            label="Start workout"
            icon={<Play className="size-5" />}
            title="What are you training today?"
            variant="secondary"
            size="lg"
            triggerClassName="h-12 w-full text-base"
          >
            <StartChoices memberId={me.id} />
          </Dialog>
        </Card>
      )}

      <Card className="flex items-center gap-3 p-4 text-sm text-muted">
        <Nfc className="size-5 shrink-0" />
        During a workout, tap your phone on any machine to add it and record your sets.
      </Card>

      {recent && recent.length > 0 && (
        <Card>
          <p className="px-5 pt-4 pb-2 font-semibold">Recent workouts</p>
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/portal/train?workout=${s.id}`} scroll={false} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-canvas/50">
                  <span>
                    {s.day_name ?? "Workout"}
                    <span className="block text-xs text-muted">{formatDateTime(s.started_at, membership.timezone)}</span>
                  </span>
                  <span className="text-xs text-muted">{s.set_logs[0]?.count ?? 0} sets</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// "What are you training today?" — a program day, or a free workout.
async function StartChoices({ memberId }: { memberId: string }) {
  const supabase = await createClient();
  const programs = await loadActivePrograms(supabase, memberId);
  const withDays = programs.filter((p) => p.days.some((d) => d.exercises.length > 0));

  return (
    <div className="space-y-6">
      {withDays.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Follow a program</h2>
          {withDays.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted">{p.kind === "trainer" ? "From your trainer" : "Your own program"}</p>
              </div>
              <ul className="divide-y divide-line">
                {p.days
                  .filter((d) => d.exercises.length > 0)
                  .map((d) => (
                    <li key={d.id}>
                      <form action={startWorkout.bind(null, p.id, d.id, d.name)}>
                        <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-canvas/50">
                          <span>
                            <span className="block font-medium">{d.name}</span>
                            <span className="block text-xs text-muted">
                              {d.exercises.length} exercises · {d.exercises.slice(0, 3).map((e) => e.exercise.name).join(", ")}
                              {d.exercises.length > 3 ? "…" : ""}
                            </span>
                          </span>
                          <ChevronRight className="size-5 text-muted" />
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="space-y-3 p-5">
          <p className="font-medium">You don&apos;t have a program yet</p>
          <p className="text-sm text-muted">Build your own or ask a trainer — or just start a free workout below.</p>
          <Link href="/portal/programs" className={buttonClass("secondary", "h-9")}>
            Go to my programs
          </Link>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Or train freely</h2>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-muted">
            Start an empty workout, then add exercises yourself or tap your phone on each machine you use.
          </p>
          <form action={startFreeWorkout}>
            <button className={buttonClass("primary", "h-12 w-full text-base")}>
              <ListPlus className="size-5" /> Start a free workout
            </button>
          </form>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Nfc className="size-4" /> Tapping a machine also starts a free workout if you haven&apos;t started one.
          </p>
        </Card>
      </section>
    </div>
  );
}
