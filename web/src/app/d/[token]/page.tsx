import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DoorTap } from "./door-tap";

export const metadata: Metadata = { title: "Open door" };

// Opened by tapping a door's NFC sticker (one per door, from Access → the door).
export default function DoorTapPage({ params }: PageProps<"/d/[token]">) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-ink text-white">
          <Loader2 className="size-16 animate-spin" />
        </main>
      }
    >
      <Gate params={params} />
    </Suspense>
  );
}

async function Gate({ params }: { params: PageProps<"/d/[token]">["params"] }) {
  const { token } = await params;
  const viewer = await getViewer();
  // First tap on a new phone: log in once, then come straight back here.
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/d/${token}`)}`);
  // Only ask the phone for its location where the gym requires it.
  const supabase = await createClient();
  const { data: needsLocation } = await supabase.rpc("door_needs_location", { p_token: token });
  return <DoorTap token={token} needsLocation={Boolean(needsLocation)} />;
}
