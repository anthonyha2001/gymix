import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MachineDetail } from "@/components/machine-detail";
import { Logo, Skeleton } from "@/components/ui";
import { getViewer, homePathFor } from "@/lib/session";
import { accountStatus, hiddenPortalPages } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Machine" };

// Opened by tapping the NFC sticker on a machine: how to use it + your numbers.
export default function MachineStickerPage({ params, searchParams }: PageProps<"/m/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Machine params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Machine({ params, searchParams }: { params: PageProps<"/m/[id]">["params"]; searchParams: PageProps<"/m/[id]">["searchParams"] }) {
  const [{ id }, { n }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/m/${id}${n === "1" ? "?n=1" : ""}`)}`);
  // Opened from the NFC sticker itself (its link ends in ?n=1): the owner
  // sees that this machine's sticker works.
  if (n === "1") await (await createClient()).rpc("machine_sticker_tapped", { p_machine_id: id });
  // Members: open their app with the machine slid up over the Train screen
  // (or the home page if the gym switched Train off, or the account is frozen).
  const asMember = viewer.memberships.find((m) => m.role === "member");
  if (asMember && viewer.memberships.length === 1) {
    if ((await accountStatus(asMember.gymId)).locked) redirect("/portal");
    const trainHidden = (await hiddenPortalPages(asMember.gymId)).includes("train");
    redirect(`${trainHidden ? "/portal" : "/portal/train"}?machine=${encodeURIComponent(id)}`);
  }
  const detail = await MachineDetail({ id, viewer });
  // RLS hides machines from other gyms.
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      {detail}
      <Link href={homePathFor(viewer)} className="block text-center text-sm text-muted underline underline-offset-4">
        Back to Gymix
      </Link>
    </div>
  );
}
