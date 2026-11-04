import { NfcWriteButton } from "@/components/nfc-write";
import { QrDownload, qrFor } from "@/components/qr-tools";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ExerciseAnimation } from "@/components/exercise-media";
import { RouteModal } from "@/components/route-modal";
import { Card, SectionTitle, buttonClass } from "@/components/ui";
import { capitalize, mediaUrl, musclesLabel } from "@/lib/exercises";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { CopyLink } from "../settings/settings-form";
import { ActionButton } from "../members/action-button";
import { addMachineExercise, deleteMachine, removeMachineExercise, updateMachine } from "./actions";
import { AddExercisesToMachine, EditMachineForm } from "./machine-form";

// One machine (?machine=<id>), as a dialog over the Equipment page.
export async function MachineModal({ machineId, gymId, canManage }: { machineId: string; gymId: string; canManage: boolean }) {
  const supabase = await createClient();
  const { data: machine } = await supabase
    .from("gym_machines")
    .select("*, machine_exercises(exercises(id, name, equipment, primary_muscles, secondary_muscles, instructions, image_paths))")
    .eq("id", machineId)
    .eq("gym_id", gymId)
    .maybeSingle();
  if (!machine) return null;

  const exercises = machine.machine_exercises.map((me) => me.exercises).filter((e) => e !== null);
  const stickerUrl = `${await requestOrigin()}/m/${machine.id}`;
  const qr = await qrFor(stickerUrl, 140);

  return (
    <RouteModal param="machine" title={machine.name} size="xl">
    <div className="space-y-6">
      <Card className="flex flex-wrap items-start gap-5 p-5">
        {machine.photo_path ? (
          <div className="relative size-32 shrink-0 overflow-hidden rounded-lg bg-canvas">
            <Image src={mediaUrl(machine.photo_path)} alt={machine.name} fill unoptimized sizes="128px" className="object-cover" />
          </div>
        ) : (
          <ExerciseAnimation paths={exercises[0]?.image_paths} name={machine.name} className="size-32" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{machine.name}</p>
          {machine.description && <p className="text-sm text-muted">{machine.description}</p>}
          <p className="mt-2 text-sm">
            Works: {musclesLabel([...new Set(exercises.flatMap((e) => e.primary_muscles))]) || "—"}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-start gap-2">
            <Dialog label="Edit" title={`Edit ${machine.name}`} variant="secondary">
              <EditMachineForm
                action={updateMachine.bind(null, machine.id)}
                name={machine.name}
                description={machine.description}
                hasPhoto={Boolean(machine.photo_path)}
              />
            </Dialog>
            <ActionButton
              action={async () => {
                "use server";
                await deleteMachine(machine.id);
                return {};
              }}
              label="Delete"
              variant="ghost"
              className="h-10"
              confirm="Delete this machine? Programs keep their exercises, but they won't count as available here anymore."
            />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            canManage && (
              <Dialog label="Add exercises" icon={<Plus className="size-4" />} title="Add exercises" description="Pick everything members can do on this machine." size="xl" variant="secondary" triggerClassName="h-9">
                <AddExercisesToMachine selectedIds={exercises.map((e) => e.id)} add={addMachineExercise.bind(null, machine.id)} />
              </Dialog>
            )
          }
        >
          Exercises on this machine
        </SectionTitle>
        <ul className="divide-y divide-line border-t border-line">
          {exercises.map((ex) => (
            <li key={ex.id} className="flex gap-4 px-5 py-4">
              <ExerciseAnimation paths={ex.image_paths} name={ex.name} className="size-24" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{ex.name}</p>
                    <p className="text-xs text-muted">
                      {musclesLabel(ex.primary_muscles)}
                      {ex.secondary_muscles.length ? ` (also ${musclesLabel(ex.secondary_muscles).toLowerCase()})` : ""} ·{" "}
                      {capitalize(ex.equipment)}
                    </p>
                  </div>
                  {canManage && exercises.length > 1 && (
                    <form action={removeMachineExercise.bind(null, machine.id, ex.id)}>
                      <button className={buttonClass("ghost", "h-8 px-2 text-xs")}>Remove</button>
                    </form>
                  )}
                </div>
                {ex.instructions.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">How to do it</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      {ex.instructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="grid gap-5 p-5 md:grid-cols-[1fr_140px]">
        <div className="space-y-3">
          <h2 className="font-semibold">Machine sticker</h2>
          <p className="text-sm text-muted">
            Put an NFC sticker on the machine with this link. Members tap it (or scan the QR code from their app) and the
            machine slides up in their app: how to use it and their last weights on it.
          </p>
          <NfcWriteButton url={stickerUrl} />
          <CopyLink url={stickerUrl} />
          <QrDownload png={qr.png} name={machine.name} />
        </div>
        <figure className="text-center">
          <div className="mx-auto w-[140px] rounded-lg border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <figcaption className="mt-1 text-xs text-muted">For phones without NFC</figcaption>
        </figure>
      </Card>

    </div>
    </RouteModal>
  );
}
