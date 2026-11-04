import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ProgramView } from "@/lib/program-shared";

type Client = Awaited<ReturnType<typeof createClient>>;

const SELECT = `
  id, gym_id, member_id, name, notes, kind, is_active, request_id, updated_at,
  program_days (
    id, name, position,
    program_exercises (
      id, position, sets, reps, target_weight_kg, rest_seconds, notes,
      exercise:exercises!program_exercises_exercise_id_fkey (id, name, image_paths, primary_muscles, instructions),
      original:exercises!program_exercises_swapped_from_fkey (name)
    )
  )
`;

type Row = {
  id: string;
  gym_id: string;
  member_id: string | null;
  name: string;
  notes: string | null;
  kind: string;
  is_active: boolean;
  request_id: string | null;
  updated_at: string;
  program_days: {
    id: string;
    name: string;
    position: number;
    program_exercises: {
      id: string;
      position: number;
      sets: number;
      reps: string;
      target_weight_kg: number | null;
      rest_seconds: number;
      notes: string | null;
      exercise: { id: string; name: string; image_paths: string[]; primary_muscles: string[]; instructions: string[] };
      original: { name: string } | null;
    }[];
  }[];
};

function toView(p: Row): ProgramView {
  return {
    id: p.id,
    gymId: p.gym_id,
    memberId: p.member_id,
    name: p.name,
    notes: p.notes,
    kind: p.kind as ProgramView["kind"],
    isActive: p.is_active,
    requestId: p.request_id,
    updatedAt: p.updated_at,
    days: [...p.program_days]
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        position: d.position,
        exercises: [...d.program_exercises]
          .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
          .map((pe) => ({
            id: pe.id,
            position: pe.position,
            sets: pe.sets,
            reps: pe.reps,
            targetWeightKg: pe.target_weight_kg === null ? null : Number(pe.target_weight_kg),
            restSeconds: pe.rest_seconds,
            notes: pe.notes,
            swappedFromName: pe.original?.name ?? null,
            exercise: {
              id: pe.exercise.id,
              name: pe.exercise.name,
              imagePaths: pe.exercise.image_paths,
              primaryMuscles: pe.exercise.primary_muscles,
              instructions: pe.exercise.instructions,
            },
          })),
      })),
  };
}

export async function loadProgram(supabase: Client, programId: string) {
  const { data } = await supabase.from("programs").select(SELECT).eq("id", programId).maybeSingle();
  return data ? toView(data as unknown as Row) : null;
}

// A member's programs to train from: active ones, trainer's first, newest first.
export async function loadActivePrograms(supabase: Client, memberId: string) {
  const { data } = await supabase
    .from("programs")
    .select(SELECT)
    .eq("member_id", memberId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as unknown as Row[])
    .map(toView)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "trainer" ? -1 : 1));
}
