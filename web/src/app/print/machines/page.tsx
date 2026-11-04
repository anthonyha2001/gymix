import type { Metadata } from "next";
import { Suspense } from "react";
import { qrFor } from "@/components/qr-tools";
import { Skeleton } from "@/components/ui";
import { requestOrigin } from "@/lib/origin";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Machine QR codes" };

// A printable sheet with every machine's QR code, cut out and stuck next to
// each machine. Opened in its own tab from Equipment so it prints on its own.
export default function PrintMachinesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 bg-white px-6 py-8 print:max-w-none print:p-0">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Sheet />
      </Suspense>
    </main>
  );
}

async function Sheet() {
  const { membership } = await requireStaff();
  const supabase = await createClient();
  const { data: machines } = await supabase.from("gym_machines").select("id, name").eq("gym_id", membership.gymId).order("name");
  const origin = await requestOrigin();
  const cards = await Promise.all(
    (machines ?? []).map(async (m) => ({ ...m, svg: (await qrFor(`${origin}/m/${m.id}`, 220)).svg })),
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Machine QR codes</h1>
          <p className="text-sm text-muted">
            {cards.length} machine{cards.length === 1 ? "" : "s"} at {membership.gymName}. Cut along the lines and stick each
            code next to its machine.
          </p>
        </div>
        <PrintButton />
      </div>
      {!cards.length ? (
        <p className="text-sm text-muted">No machines registered yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-0">
          {cards.map((m) => (
            <div key={m.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-dashed border-ink/30 p-4 text-center print:rounded-none">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">{membership.gymName}</p>
              <p className="text-lg leading-tight font-bold">{m.name}</p>
              <div className="w-[180px]" dangerouslySetInnerHTML={{ __html: m.svg }} />
              <p className="text-xs text-muted">Scan in the Gymix app or tap your phone to see how to use this machine</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
