import Link from "next/link";
import { Dumbbell, Play } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { TrainingPlan } from "@/lib/training-plan";
import { startFreeWorkout, startWorkout } from "@/app/portal/actions";

// Roughly 8 minutes per exercise (3-4 sets with rest).
export const minutesFor = (exercises: number) => Math.max(15, Math.round((exercises * 8) / 5) * 5);

// Today's workout with one big Start button. On the home screen and in the
// shake-to-start sheet.
export function TodayWorkout({ plan, weekdayName, preview = false }: { plan: TrainingPlan; weekdayName: string; preview?: boolean }) {
  const t = plan.today;
  return (
    <section className="overflow-hidden rounded-3xl bg-ink text-white">
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Today · {weekdayName}
          {t && !t.planned && plan.isTrainingDay ? " · next up" : ""}
        </p>
        {t ? (
          <>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{t.name}</h2>
            <p className="mt-1 text-sm text-white/70">
              {t.programName} · {t.exercises} exercise{t.exercises === 1 ? "" : "s"} · about {minutesFor(t.exercises)} min
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{plan.programDays.length ? "All done this week" : "Ready when you are"}</h2>
            <p className="mt-1 text-sm text-white/70">
              {plan.programDays.length ? "You've trained every day of your program this week." : "Get a program from a trainer or build your own."}
            </p>
          </>
        )}
      </div>
      {!preview && (
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {t ? (
            <form action={startWorkout.bind(null, t.programId, t.id, t.name)} className="flex-1">
              <button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-ink transition active:scale-[0.98]">
                <Play className="size-5 fill-current" /> Start workout
              </button>
            </form>
          ) : (
            <>
              <form action={startFreeWorkout} className="flex-1">
                <button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-ink transition active:scale-[0.98]">
                  <Dumbbell className="size-5" /> Free workout
                </button>
              </form>
              {!plan.programDays.length && (
                <Link href="/portal/programs" className={buttonClass("secondary", "h-14 flex-1 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/15")}>
                  Get a program
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
