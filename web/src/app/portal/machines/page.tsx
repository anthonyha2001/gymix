import type { Metadata } from "next";
import Image from "next/image";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import { Nfc } from "lucide-react";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Card, Skeleton } from "@/components/ui";
import { MachineSheet } from "@/components/machine-sheet";
import { mediaUrl, musclesLabel } from "@/lib/exercises";
import { requirePortalPage } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Machines" };

export default function MemberMachinesPage({ searchParams }: PageProps<"/portal/machines">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
        <p className="text-sm text-muted">Tap a machine to see how it&apos;s used — or tap your phone on the sticker on the machine itself.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Machines searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Machines({ searchParams }: { searchParams: PageProps<"/portal/machines">["searchParams"] }) {
  const { machine } = await searchParams;
  const { viewer, membership } = await requirePortalPage("machines");
  const supabase = await createClient();
  const { data: machines } = await supabase
    .from("gym_machines")
    .select("id, name, description, photo_path, machine_exercises(exercises(name, primary_muscles, image_paths))")
    .eq("gym_id", membership.gymId)
    .order("name");

  if (!machines?.length) {
    return <Card className="p-6 text-sm text-muted">Your gym hasn&apos;t added its machines yet.</Card>;
  }

  const open = typeof machine === "string" ? machines.find((m) => m.id === machine) : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {open && <MachineSheet machineId={open.id} viewer={viewer} />}
      {machines.map((m) => {
        const exercises = m.machine_exercises.map((me) => me.exercises).filter((e) => e !== null);
        const muscles = [...new Set(exercises.flatMap((e) => e.primary_muscles))];
        return (
          <HoverLink key={m.id} href={`/portal/machines?machine=${m.id}`} scroll={false}>
            <Card className="flex h-full gap-4 p-4 transition-colors hover:border-ink/30">
              {m.photo_path ? (
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
                  <Image src={mediaUrl(m.photo_path)} alt="" fill unoptimized sizes="80px" className="object-cover" />
                </div>
              ) : (
                <ExerciseAnimation paths={exercises[0]?.image_paths} name={m.name} />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{m.name}</p>
                <p className="line-clamp-2 text-xs text-muted">{musclesLabel(muscles)}</p>
                <p className="mt-1 text-xs font-medium text-ink/70">
                  {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · how to use →
                </p>
              </div>
            </Card>
          </HoverLink>
        );
      })}
      <Card className="flex items-center gap-3 p-4 text-sm text-muted sm:col-span-2">
        <Nfc className="size-5 shrink-0" /> Machines with a Gymix sticker open this page when you tap your phone on them.
      </Card>
    </div>
  );
}
