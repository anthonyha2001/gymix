import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";
import { qrFor } from "@/components/qr-tools";
import { exerciseImageUrl, mediaUrl } from "@/lib/exercises";
import { requestOrigin } from "@/lib/origin";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { machineStickerUrl } from "@/lib/url";
import { StickerSetup, type StickerMachine } from "./sticker-setup";

export const metadata: Metadata = { title: "Machine stickers" };

// One NFC sticker per machine, set up one after the other from the owner's
// phone. Shows which machines still need one, and which stickers members
// have actually tapped.
export default function StickersPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/machines?tab=machines" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Equipment
      </Link>
      <PageHeader title="Machine stickers" description="Put an NFC sticker on each machine. Members tap it to see how the machine is used and their last weights on it." />
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <Stickers />
      </Suspense>
    </div>
  );
}

async function Stickers() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_machines")
    .select("id, name, photo_path, sticker_at, sticker_tapped_at, machine_exercises(exercises(image_paths))")
    .eq("gym_id", membership.gymId)
    .order("name");

  const origin = await requestOrigin();
  const machines: StickerMachine[] = (data ?? []).map((m) => {
    const firstImage = m.machine_exercises.map((me) => me.exercises?.image_paths?.[0]).find(Boolean);
    return {
      id: m.id,
      name: m.name,
      thumb: m.photo_path ? mediaUrl(m.photo_path) : firstImage ? exerciseImageUrl(firstImage) : null,
      url: machineStickerUrl(origin, m.id),
      stickerAt: m.sticker_at,
      tappedAt: m.sticker_tapped_at,
    };
  });
  const pageUrl = `${origin}/dashboard/machines/stickers`;
  const { svg } = await qrFor(pageUrl, 168);

  return <StickerSetup machines={machines} pageUrl={pageUrl} pageQr={svg} />;
}
