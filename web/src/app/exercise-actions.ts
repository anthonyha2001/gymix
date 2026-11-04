"use server";

import { createClient } from "@/lib/supabase/server";
import { requireGymUser, requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import type { Exercise } from "@/lib/exercises";

const FIELDS = "id, name, equipment, primary_muscles, image_paths, level";

// Strip characters PostgREST uses as filter syntax.
const clean = (q: string) => q.replace(/[%,()*\\]/g, " ").trim();

// Whole library — for owners adding machines.
export async function searchCatalog(q: string, muscle = "", equipment = ""): Promise<Exercise[]> {
  await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  let query = supabase.from("exercises").select(FIELDS).order("name").limit(40);
  if (clean(q)) query = query.ilike("name", `%${clean(q)}%`);
  if (muscle) query = query.contains("primary_muscles", [muscle]);
  if (equipment) query = query.eq("equipment", equipment);
  const { data } = await query;
  return data ?? [];
}

// What this gym can do — for building programs.
export async function searchGymExercises(q: string, muscle = ""): Promise<Exercise[]> {
  const { membership } = await requireGymUser();
  const supabase = await createClient();
  let query = supabase.from("gym_exercises").select(FIELDS).eq("gym_id", membership.gymId).order("name").limit(40);
  if (clean(q)) query = query.ilike("name", `%${clean(q)}%`);
  if (muscle) query = query.contains("primary_muscles", [muscle]);
  const { data } = await query;
  return (data ?? []) as Exercise[];
}

// Same-muscle exercises this gym has — for swapping. Closest matches first:
// same equipment (a machine for a machine), then same muscles, then same level.
export async function exerciseAlternatives(exerciseId: string): Promise<Exercise[]> {
  const { membership } = await requireGymUser();
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("exercises")
    .select("primary_muscles, equipment, level, category")
    .eq("id", exerciseId)
    .single();
  if (!current?.primary_muscles.length) return [];
  const { data } = await supabase
    .from("gym_exercises")
    .select(`${FIELDS}, category`)
    .eq("gym_id", membership.gymId)
    .overlaps("primary_muscles", current.primary_muscles)
    .neq("id", exerciseId)
    .limit(300);

  const sameMuscles = (m: string[]) =>
    m.length === current.primary_muscles.length && m.every((x) => current.primary_muscles.includes(x));
  const score = (e: Exercise & { category?: string | null }) =>
    (e.equipment === current.equipment ? 4 : 0) +
    (sameMuscles(e.primary_muscles) ? 2 : 0) +
    (e.level === current.level ? 1 : 0) +
    // Don't suggest a stretch to replace a strength exercise (or vice versa).
    (e.category === current.category ? 3 : 0);

  return ((data ?? []) as (Exercise & { category?: string | null })[])
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 24);
}
