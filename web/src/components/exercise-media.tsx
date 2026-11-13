import { Dumbbell } from "lucide-react";
import { MOTION_PREFIX } from "@/lib/exercises";
import { MotionClip } from "@/components/motion-clip";

// Shows how an exercise is done: Gymix motion exercises (image path
// "motion:<id>") play their animated clip; `live` shows it with the 3D athlete
// (detail views). Anything else gets a placeholder icon.
export function ExerciseAnimation({
  paths,
  name,
  className = "size-20",
  live = false,
}: {
  paths: string[] | null | undefined;
  name: string;
  className?: string;
  live?: boolean;
}) {
  const motion = paths?.[0]?.startsWith(MOTION_PREFIX) ? paths[0].slice(MOTION_PREFIX.length) : null;
  if (motion) return <MotionClip id={motion} name={name} className={className} live={live} />;
  return (
    <div className={`grid shrink-0 place-items-center rounded-lg bg-canvas text-muted ${className}`} aria-hidden>
      <Dumbbell className="size-1/3" />
    </div>
  );
}
