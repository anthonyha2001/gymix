import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireMember } from "@/lib/session";
import { TapCheckIn } from "../c/[token]/tap-check-in";

export const metadata: Metadata = { title: "Check in" };

// Simulated entrance tap (double-space in the member portal) — same screens as a real sticker tap.
export default function SimulatedTapPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-ink text-white">
          <Loader2 className="size-16 animate-spin" />
        </main>
      }
    >
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await requireMember();
  return <TapCheckIn simulated />;
}
