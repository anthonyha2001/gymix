import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MachineDetail } from "@/components/machine-detail";
import { Logo, Skeleton } from "@/components/ui";
import { getViewer, homePathFor } from "@/lib/session";
import { accountStatus, hiddenPortalPages } from "@/lib/portal";

export const metadata: Metadata = { title: "Machine" };

// Opened by tapping the NFC sticker on a machine: how to use it + your numbers.
export default function MachineStickerPage({ params }: PageProps<"/m/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Machine params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Machine({ params }: { params: PageProps<"/m/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/m/${id}`)}`);
  // Members: open their app with the machine slid up over the Train screen
  // (or the home page if the gym switched Train off, or the account is frozen).
  const asMember = viewer.memberships.find((m) => m.role === "member");
  if (asMember && viewer.memberships.length === 1) {
    if ((await accountStatus(asMember.gymId)).frozen) redirect("/portal");
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
