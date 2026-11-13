import type { Metadata } from "next";
import { Suspense } from "react";
import { Radio } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/session";
import { RoomHeader } from "../room-head";
import { Studio } from "./studio";

export const metadata: Metadata = { title: "Motion lab" };

// Gymix's own exercise library and motion generator. The seed library is
// published to the app's exercise catalog (web/scripts/motion-catalog.ts);
// edits made here are drafts kept in this browser.
export default function MotionPage() {
  return (
    <div className="space-y-6">
      <RoomHeader
        eyebrow="Motion lab"
        title="Exercise motion studio"
        description="Build an exercise from a movement, shape it, light the muscles it works, and export the clip."
        action={
          <span className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/25">
            <Radio className="size-3.5" /> Library live in the app · edits here are drafts
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
