"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function uploadPhoto(gymId: string, file: File) {
  if (!file.size) return { path: null };
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return { error: "Photo must be a JPG, PNG or WebP image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Photo must be under 5 MB." };
  const supabase = await createClient();
  const path = `${gymId}/machines/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("gym-media").upload(path, file, { contentType: file.type });
  if (error) return { error: "Couldn't upload the photo." };
  return { path };
}

export async function createMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(MANAGER_ROLES);
  const name = text(formData, "name");
  const description = text(formData, "description");
  const exerciseIds = [...new Set(formData.getAll("exercise_ids").map(String))];
  if (name.length < 2) return { error: "Give the machine a name." };
  if (!exerciseIds.length) return { error: "Pick at least one exercise done on this machine." };

  const photo = formData.get("photo");
  const upload = photo instanceof File ? await uploadPhoto(membership.gymId, photo) : { path: null };
  if ("error" in upload) return { error: upload.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_machines")
    .insert({
      gym_id: membership.gymId,
      name,
      description: description || null,
      photo_path: upload.path,
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (error) return { error: errorMessage(error, "Couldn't save the machine.") };

  const { error: linkError } = await supabase
    .from("machine_exercises")
    .insert(exerciseIds.map((exercise_id) => ({ machine_id: data.id, exercise_id })));
  if (linkError) return { error: errorMessage(linkError, "Saved the machine, but couldn't link its exercises.") };

  redirect(`/dashboard/machines?tab=machines&machine=${data.id}`);
}

export async function updateMachine(machineId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const name = text(formData, "name");
  if (name.length < 2) return { error: "Give the machine a name." };

  const supabase = await createClient();
  const { data: machine } = await supabase
    .from("gym_machines")
    .select("photo_path")
    .eq("id", machineId)
    .eq("gym_id", membership.gymId)
    .single();
  if (!machine) return { error: "Machine not found." };

  const update: { name: string; description: string | null; photo_path?: string | null } = {
    name,
    description: text(formData, "description") || null,
  };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size) {
    const upload = await uploadPhoto(membership.gymId, photo);
    if ("error" in upload) return { error: upload.error };
    update.photo_path = upload.path;
  } else if (formData.get("remove_photo") === "on") {
    update.photo_path = null;
  }

  const { error } = await supabase.from("gym_machines").update(update).eq("id", machineId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  if (update.photo_path !== undefined && machine.photo_path) {
    await supabase.storage.from("gym-media").remove([machine.photo_path]);
  }
  refresh();
  return { success: "Saved." };
}

export async function setEquipment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gym_equipment", {
    p_gym_id: membership.gymId,
    p_equipment: formData.getAll("equipment").map(String),
  });
  if (error) return { error: errorMessage(error, "Couldn't save your equipment.") };
  refresh();
  return { success: "Saved. Trainers and members can now use these exercises." };
}

// Links an exercise to a machine. A plain upsert needs UPDATE rights, which
// staff don't have on this table, so it always failed; "ignore duplicates"
// (ON CONFLICT DO NOTHING) needs only INSERT.
export async function addMachineExercise(machineId: string, exerciseId: string): Promise<ActionState> {
  await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("machine_exercises")
    .upsert({ machine_id: machineId, exercise_id: exerciseId }, { ignoreDuplicates: true });
  if (error) return { error: errorMessage(error, "Couldn't add the exercise.") };
  refresh();
  return { success: "Added." };
}

export async function removeMachineExercise(machineId: string, exerciseId: string) {
  await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  await supabase.from("machine_exercises").delete().eq("machine_id", machineId).eq("exercise_id", exerciseId);
  refresh();
}

export async function deleteMachine(machineId: string) {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { data: machine } = await supabase
    .from("gym_machines")
    .delete()
    .eq("id", machineId)
    .eq("gym_id", membership.gymId)
    .select("photo_path")
    .maybeSingle();
  if (machine?.photo_path) await supabase.storage.from("gym-media").remove([machine.photo_path]);
  redirect("/dashboard/machines?tab=machines");
}

// The machine's NFC sticker: written from Gymix, or ticked done after writing
// it with another app. `done: false` puts it back on the to-do list.
export async function setStickerDone(machineId: string, done: boolean): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_machines")
    .update({ sticker_at: done ? new Date().toISOString() : null })
    .eq("id", machineId)
    .eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save the sticker.") };
  refresh();
  return {};
}
