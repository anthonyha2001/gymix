"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/dialog";
import { ExerciseHowTo } from "@/components/exercise-how-to";
import { exerciseInstructions } from "@/app/exercise-actions";

export type PreviewExercise = { id: string; name: string; imagePaths: string[]; primaryMuscles: string[] };

// Popup showing one exercise full size (opened by double-clicking it).
export function ExercisePreview({ exercise, onClose }: { exercise: PreviewExercise | null; onClose: () => void }) {
  const [steps, setSteps] = useState<{ id: string; list: string[] } | null>(null);

  useEffect(() => {
    if (!exercise) return;
    let live = true;
    exerciseInstructions(exercise.id).then((list) => live && setSteps({ id: exercise.id, list }));
    return () => {
      live = false;
    };
  }, [exercise]);

  return (
    <Modal open={!!exercise} onClose={onClose} title={exercise?.name ?? ""} size="lg">
      {exercise && (
        <ExerciseHowTo
          name={exercise.name}
          imagePaths={exercise.imagePaths}
          primaryMuscles={exercise.primaryMuscles}
          instructions={steps?.id === exercise.id ? steps.list : []}
          loading={steps?.id !== exercise.id}
        />
      )}
    </Modal>
  );
}
