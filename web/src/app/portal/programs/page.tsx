import type { Metadata } from "next";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import { ChevronRight, Play, Plus, UserRoundPlus , Pencil } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { ExerciseItem } from "@/components/program-card";
import { ProgramBuilder } from "@/components/program-builder";
import { RouteModal } from "@/components/route-modal";
import { Badge, Card, Skeleton, buttonClass } from "@/components/ui";
import { GOAL_LABELS } from "@/lib/exercises";
import { loadExerciseStats } from "@/lib/exercise-stats";
import { formatDate } from "@/lib/format";
import { requirePortalPage } from "@/lib/portal";
import { loadProgram } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { deleteProgram } from "@/app/program-actions";
import { ActionButton } from "../../dashboard/members/action-button";
import { cancelMyRequest, startWorkout } from "../actions";
import { DeleteProgramButton, NewSelfProgramForm, RequestProgramForm } from "./forms";

export const metadata: Metadata = { title: "My programs" };

const TABS = ["programs", "requests"] as const;
const BASE = "/portal/programs";

export default function ProgramsPage({ searchParams }: PageProps<"/portal/programs">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Programs searchParams={searchParams} />
    </Suspense>
  );
}

async function Programs({ searchParams }: { searchParams: PageProps<"/portal/programs">["searchParams"] }) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const here = `${BASE}?tab=${tab}`;
  const { viewer, membership } = await requirePortalPage("programs");
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet.</Card>;

  const [{ data: programs }, { data: requests }, { data: coaches }, { data: gym }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, kind, is_active, updated_at, program_days(id, program_exercises(count))")
      .eq("member_id", me.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("program_requests")
      .select("id, goal, status, created_at")
      .eq("member_id", me.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("gym_coaches", { p_gym_id: membership.gymId }),
    supabase.from("gyms").select("program_price_usd").eq("id", membership.gymId).single(),
  ]);
  const openRequest = requests?.find((r) => r.status === "open" || r.status === "in_progress");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My programs</h1>
        <div className="flex flex-wrap gap-2">
          <Dialog label="Create my own" icon={<Plus className="size-4" />} title="Create your own program" triggerClassName="h-9">
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Give your program a name.</li>
              <li>Add training days, for example “Push”, “Pull”, “Legs”.</li>
              <li>Add exercises to each day with sets, reps and weight.</li>
            </ol>
            <NewSelfProgramForm />
          </Dialog>
          {!openRequest && (
            <Dialog
              label="Ask a trainer"
              variant="secondary"
              icon={<UserRoundPlus className="size-4" />}
              title="Ask a trainer for a program"
              description="Tell us your goal. A trainer builds it on your gym's equipment, with a how-to for every exercise."
              size="lg"
              triggerClassName="h-9"
            >
              <RequestProgramForm coaches={coaches ?? []} price={Number(gym?.program_price_usd ?? 0)} />
            </Dialog>
          )}
        </div>
      </div>

      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={[
          { id: "programs", label: "My programs", count: programs?.length ?? 0 },
          { id: "requests", label: "Trainer requests", count: openRequest ? 1 : 0 },
        ]}
      />

      {typeof query.program === "string" && <ProgramModal programId={query.program} memberId={me.id} />}
      {typeof query.edit === "string" && <EditModal programId={query.edit} closePath={here} />}

      <TabPanel id="programs" tabs={TABS}>{(!programs?.length ? (
          <Card className="space-y-2 p-8 text-center">
            <p className="font-medium">No programs yet</p>
            <p className="text-sm text-muted">Create your own from your gym&apos;s equipment, or ask a trainer to build one for you.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {programs.map((p) => {
              const exercises = p.program_days.reduce((n, d) => n + (d.program_exercises[0]?.count ?? 0), 0);
              return (
                <HoverLink key={p.id} href={`${BASE}?tab=programs&program=${p.id}`} scroll={false}>
                  <Card className="flex items-center gap-4 p-5 transition-colors hover:border-ink/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{p.name}</p>
                        <Badge tone={p.kind === "trainer" ? "blue" : "gray"}>{p.kind === "trainer" ? "From your trainer" : "Built by you"}</Badge>
                      </div>
                      <p className="text-sm text-muted">
                        {p.program_days.length} training day{p.program_days.length === 1 ? "" : "s"} · {exercises} exercises
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted" />
                  </Card>
                </HoverLink>
              );
            })}
          </div>
        ))}</TabPanel>

      <TabPanel id="requests" tabs={TABS}>{(!requests?.length ? (
          <Card className="space-y-2 p-8 text-center">
            <p className="font-medium">No requests</p>
            <p className="text-sm text-muted">Use “Ask a trainer” and a trainer will build a program for you.</p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium">{GOAL_LABELS[r.goal]}</p>
                    <p className="text-sm text-muted">
                      Asked {formatDate(r.created_at)} ·{" "}
                      {
                        {
                          open: "waiting for a trainer",
                          in_progress: "a trainer is building it now",
                          done: "your program is ready",
                          cancelled: "cancelled",
                        }[r.status]
                      }
                    </p>
                  </div>
                  {r.status === "open" && (
                    <ActionButton action={cancelMyRequest.bind(null, r.id)} label="Cancel request" variant="ghost" confirm="Cancel your program request?" />
                  )}
                  {r.status === "done" && <Badge tone="green">Ready</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}</TabPanel>
    </div>
  );
}

// A program's days and exercises, each day with its own Start button.
async function ProgramModal({ programId, memberId }: { programId: string; memberId: string }) {
  const supabase = await createClient();
  const program = await loadProgram(supabase, programId);
  if (!program || program.memberId !== memberId) return null;
  const stats = await loadExerciseStats(
    supabase,
    memberId,
    program.days.flatMap((d) => d.exercises.map((e) => e.exercise.id)),
  );

  return (
    <RouteModal
      param="program"
      title={program.name}
      description={program.kind === "trainer" ? "From your trainer · tap an exercise to see how it's done" : "Built by you · tap an exercise to see how it's done"}
      size="lg"
    >
      <div className="space-y-5">
        {program.notes && <p className="rounded-lg bg-canvas p-3 text-sm">{program.notes}</p>}
        {program.kind === "self" && (
          <div className="flex gap-2">
            <HoverLink href={`${BASE}?edit=${program.id}`} scroll={false} replace aria-label="Edit program" title="Edit program" className={buttonClass("secondary", "h-10 w-10 px-0")}>
              <Pencil className="size-4" />
            </HoverLink>
            <DeleteProgramButton programId={program.id} name={program.name} />
          </div>
        )}
        {program.days.length === 0 && <p className="text-sm text-muted">No training days yet.</p>}
        {program.days.map((day, i) => (
          <section key={day.id} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">
                <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-canvas text-xs">{i + 1}</span>
                {day.name}
              </h3>
              {day.exercises.length > 0 && (
                <form action={startWorkout.bind(null, program.id, day.id, day.name)}>
                  <button aria-label={`Start ${day.name}`} className={buttonClass("primary", "h-9")}>
                    <Play className="size-4" /> Start
                  </button>
                </form>
              )}
            </div>
            {day.exercises.length === 0 ? (
              <p className="text-sm text-muted">No exercises on this day yet.</p>
            ) : (
              <ul className="space-y-3">
                {day.exercises.map((pe) => (
                  <ExerciseItem key={pe.id} pe={pe} stats={stats[pe.exercise.id]} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </RouteModal>
  );
}

// The member's own program in the builder.
async function EditModal({ programId, closePath }: { programId: string; closePath: string }) {
  const supabase = await createClient();
  const program = await loadProgram(supabase, programId);
  // Members can only edit programs they built (the database enforces this too).
  if (!program || program.kind !== "self") return null;
  const deleteAndClose = deleteProgram.bind(null, program.id, closePath);

  return (
    <RouteModal param="edit" title="Edit my program" description="Add training days and exercises. Changes save as you go." size="xl">
      <div className="space-y-4">
        <ProgramBuilder program={program} />
        <ActionButton
          action={async () => {
            "use server";
            await deleteAndClose();
            return {};
          }}
          label="Delete this program"
          variant="ghost"
          confirm="Delete your program? Logged workouts stay in your history."
        />
      </div>
    </RouteModal>
  );
}
