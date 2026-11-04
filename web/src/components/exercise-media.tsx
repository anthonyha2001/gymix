import Image from "next/image";
import { Dumbbell } from "lucide-react";
import { exerciseImageUrl } from "@/lib/exercises";

// Shows how an exercise is done by alternating its start and end photos (a
// two-frame animation). Server-safe: the animation is pure CSS.
export function ExerciseAnimation({
  paths,
  name,
  className = "size-20",
}: {
  paths: string[] | null | undefined;
  name: string;
  className?: string;
}) {
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
