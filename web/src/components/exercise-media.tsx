import Image from "next/image";
import { Dumbbell } from "lucide-react";
import { exerciseImageUrl, MOTION_PREFIX } from "@/lib/exercises";
import { MotionClip } from "@/components/motion-clip";

// Shows how an exercise is done by alternating its start and end photos (a
// two-frame animation). Server-safe: the animation is pure CSS. Gymix motion
// exercises (image path "motion:<id>") play their animated clip instead; `live`
// shows it with the 3D athlete (detail views).
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
  const frames = (paths ?? []).slice(0, 2);
  if (!frames.length) {
    return (
      <div className={`grid shrink-0 place-items-center rounded-lg bg-canvas text-muted ${className}`} aria-hidden>
        <Dumbbell className="size-1/3" />
      </div>
    );
  }
  return (
    <div className={`ex-anim relative shrink-0 overflow-hidden rounded-lg bg-canvas ${className}`}>
      {frames.map((p, i) => (
        <Image
          key={p}
          src={exerciseImageUrl(p)}
          alt={i === 0 ? `How to do ${name}` : ""}
          fill
          unoptimized
          sizes="200px"
          className="object-cover"
        />
      ))}
    </div>
  );
}
