import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getViewer } from "@/lib/session";
import { TapCheckIn } from "./tap-check-in";

export const metadata: Metadata = { title: "Check in" };

// Opened by tapping the gym's NFC sticker (or its printed QR fallback).
export default function TapPage({ params }: PageProps<"/c/[token]">) {
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

async function Gate({ params }: { params: PageProps<"/c/[token]">["params"] }) {
  const { token } = await params;
  const viewer = await getViewer();
  // First tap on a new phone: log in once, then come straight back here.
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/c/${token}`)}`);
  return <TapCheckIn token={token} />;
}
