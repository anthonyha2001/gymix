// Client-safe program shapes (loaded by lib/programs.ts on the server).

export type ProgramExerciseView = {
  id: string;
  position: number;
  sets: number;
  reps: string;
  targetWeightKg: number | null;
  restSeconds: number;
  notes: string | null;
  swappedFromName: string | null;
  exercise: {
    id: string;
    name: string;
    imagePaths: string[];
    primaryMuscles: string[];
    instructions: string[];
  };
};

export type ProgramDayView = { id: string; name: string; position: number; exercises: ProgramExerciseView[] };

export type ProgramView = {
  id: string;
  gymId: string;
  memberId: string | null;
  name: string;
  notes: string | null;
  kind: "trainer" | "self" | "template";
  isActive: boolean;
  requestId: string | null;
  updatedAt: string;
  days: ProgramDayView[];
};

export function setsLabel(pe: Pick<ProgramExerciseView, "sets" | "reps" | "targetWeightKg">) {
  const w = pe.targetWeightKg ? ` @ ${Number(pe.targetWeightKg)} kg` : "";
  return `${pe.sets} × ${pe.reps}${w}`;
}
