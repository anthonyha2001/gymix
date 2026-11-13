import { ExerciseAnimation } from "@/components/exercise-media";
import { formatKg, musclesLabel } from "@/lib/exercises";

export type ExerciseStats = { bestKg: number | null; last: { weight: number; reps: number } | null };

// Full "how to do it" view of one exercise (shown in a dialog when tapped).
export function ExerciseHowTo({
  name,
  imagePaths,
  primaryMuscles,
  instructions,
  stats,
}: {
  name: string;
  imagePaths: string[];
  primaryMuscles: string[];
  instructions: string[];
  stats?: ExerciseStats;
}) {
  return (
    <div className="space-y-4">
      <ExerciseAnimation paths={imagePaths} name={name} className="aspect-[4/3] w-full" live />
      <p className="text-sm text-muted">Works: {musclesLabel(primaryMuscles) || "—"}</p>
      {stats && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-canvas p-3">
            <p className="text-xs text-muted">Last time</p>
            <p className="font-semibold">{stats.last ? `${formatKg(stats.last.weight)} × ${stats.last.reps}` : "—"}</p>
          </div>
          <div className="rounded-lg bg-canvas p-3">
            <p className="text-xs text-muted">Your best</p>
            <p className="font-semibold">{stats.bestKg ? formatKg(stats.bestKg) : "—"}</p>
          </div>
        </div>
      )}
      {instructions.length > 0 ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Ask your trainer to show you this one.</p>
      )}
    </div>
  );
}
