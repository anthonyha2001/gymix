import type { Metadata } from "next";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/session";
import { RoomHeader } from "../room-head";
import { Studio } from "./studio";

export const metadata: Metadata = { title: "Motion lab" };

// Gymix's own exercise library and motion generator. A test bench: drafts
// live in this browser only and nothing here reaches gyms yet.
export default function MotionPage() {
  return (
    <div className="space-y-6">
      <RoomHeader
        eyebrow="Motion lab"
        title="Exercise motion studio"
        description="Build an exercise from a movement, shape it, light the muscles it works, and export the clip."
        action={
          <span className="flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/20">
            <FlaskConical className="size-3.5" /> Test: nothing here reaches gyms yet
          </span>
        }
      />
      <Suspense fallback={<Skeleton className="h-[44rem] bg-white/5" />}>
        <Guard />
      </Suspense>
    </div>
  );
}

async function Guard() {
  await requirePlatformAdmin();
  return <Studio />;
}
