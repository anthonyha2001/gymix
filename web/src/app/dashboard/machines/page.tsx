import type { Metadata } from "next";
import Image from "next/image";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Nfc, Plus } from "lucide-react";
import { ExerciseAnimation } from "@/components/exercise-media";
import { Dialog } from "@/components/dialog";
import { Card, PageHeader, SectionTitle, Skeleton, buttonClass } from "@/components/ui";
import { NewMachineForm } from "./machine-form";
import { mediaUrl, musclesLabel } from "@/lib/exercises";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { MachineModal } from "./machine-modal";
import { EquipmentForm } from "./equipment-form";

export const metadata: Metadata = { title: "Equipment" };

export default function EquipmentPage({ searchParams }: PageProps<"/dashboard/machines">) {
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Equipment"
        description="What your gym has. Trainers and members build programs from these exercises, each with a how-to."
      />
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <EquipmentContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const TABS = ["machines", "equipment"] as const;
const BASE = "/dashboard/machines";

async function EquipmentContent({ searchParams }: { searchParams: PageProps<"/dashboard/machines">["searchParams"] }) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const { membership } = await requireStaff();
  const canManage = MANAGER_ROLES.includes(membership.role);
  const supabase = await createClient();

  const [{ data: gym }, { data: catalog }, { count: available }, { data: machines }] = await Promise.all([
    supabase.from("gyms").select("equipment").eq("id", membership.gymId).single(),
    supabase.from("exercises").select("equipment"),
    supabase.from("gym_exercises").select("id", { count: "exact", head: true }).eq("gym_id", membership.gymId),
    supabase
      .from("gym_machines")
      .select("id, name, photo_path, sticker_at, sticker_tapped_at, machine_exercises(exercises(name, primary_muscles, image_paths))")
      .eq("gym_id", membership.gymId)
      .order("name"),
  ]);

  // Exercises per equipment type (no equipment listed counts as bodyweight).
  const counts: Record<string, number> = {};
  for (const e of catalog ?? []) {
    const key = e.equipment ?? "body only";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 bg-ink p-5 text-white">
        <div>
          <p className="text-sm text-white/70">Exercises available at your gym</p>
          <p className="text-3xl font-bold tabular-nums text-brand">{available ?? 0}</p>
        </div>
        <p className="max-w-md text-sm text-white/80">
          Members and trainers can only choose exercises for what you add here: the machines you register and the free equipment you tick. Nothing is added until you do.
        </p>
      </Card>

      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={[
          { id: "machines", label: "Machines", count: machines?.length ?? 0 },
          { id: "equipment", label: "Free weights & equipment" },
        ]}
      />

      {typeof query.machine === "string" && <MachineModal machineId={query.machine} gymId={membership.gymId} canManage={canManage} />}

      <TabPanel id="equipment" tabs={TABS}>{(
      <Card>
        <SectionTitle>Free weights & equipment</SectionTitle>
        <div className="border-t border-line p-5">
          <EquipmentForm selected={gym?.equipment ?? []} counts={counts} canEdit={canManage} />
        </div>
      </Card>
      )}</TabPanel>

      <TabPanel id="machines" tabs={TABS}>{(
      <Card>
        <SectionTitle
          action={
            <div className="flex flex-wrap gap-2">
              {canManage && !!machines?.length && (
                <Link href="/dashboard/machines/stickers" className={buttonClass("secondary", "h-9")}>
                  <Nfc className="size-4" /> Set up stickers
                  <span className="rounded-full bg-canvas px-1.5 text-xs tabular-nums text-muted">
                    {machines.filter((m) => m.sticker_at).length}/{machines.length}
                  </span>
                </Link>
              )}
              {canManage && (
                <Dialog label="Add machine" icon={<Plus className="size-4" />} title="Add a machine" size="xl" triggerClassName="h-9">
                  <NewMachineForm />
                </Dialog>
              )}
            </div>
          }
        >
          Machines
        </SectionTitle>
        <p className="border-t border-line px-5 pt-3 text-sm text-muted">
          Leg press, chest press, lat pulldown… Register each machine you have. Members can tap a sticker on it to see how
          it&apos;s used.
        </p>
        {!machines?.length ? (
          <p className="px-5 py-5 text-sm text-muted">No machines registered yet.</p>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {machines.map((m) => {
              const exercises = m.machine_exercises.map((me) => me.exercises).filter((e) => e !== null);
              const muscles = [...new Set(exercises.flatMap((e) => e.primary_muscles))];
              return (
                <HoverLink key={m.id} href={`${BASE}?tab=machines&machine=${m.id}`} scroll={false}>
                  <div className="flex h-full gap-4 rounded-xl border border-line p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-md">
                    {m.photo_path ? (
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
                        <Image src={mediaUrl(m.photo_path)} alt="" fill unoptimized sizes="80px" className="object-cover" />
                      </div>
                    ) : (
                      <ExerciseAnimation paths={exercises[0]?.image_paths} name={m.name} />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-muted">
                        {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{musclesLabel(muscles)}</p>
                      {m.sticker_tapped_at ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="size-3.5" /> Sticker working
                        </p>
                      ) : m.sticker_at ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="size-1.5 rounded-full bg-brand ring-2 ring-brand/30" /> Sticker on
                        </p>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                          <Nfc className="size-3.5" /> No sticker yet
                        </p>
                      )}
                    </div>
                  </div>
                </HoverLink>
              );
            })}
          </div>
        )}
      </Card>
      )}</TabPanel>
    </div>
  );
}
