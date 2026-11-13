import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/session";
import { Lab } from "../lab";
import { RoomHeader } from "../room-head";

export const metadata: Metadata = { title: "Lab" };

// The test gym, any gym seen as any role, and who gets which feature.
export default function LabPage() {
  return (
    <div className="space-y-6">
      <RoomHeader eyebrow="Lab" title="Try it before anyone else" description="Your test gym, any gym seen through someone else's eyes, and the switches that decide who gets each feature." />
      <div className="room-ink">
        <Suspense fallback={<Skeleton className="h-96 bg-white/5" />}>
          <Guarded />
        </Suspense>
      </div>
    </div>
  );
}

async function Guarded() {
  await requirePlatformAdmin();
  return <Lab />;
}
