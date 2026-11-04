"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus, Search } from "lucide-react";
import { ExerciseAnimation } from "@/components/exercise-media";
import { inputClass, inputWidth } from "@/components/ui";
import { EQUIPMENT, MUSCLES, capitalize, musclesLabel, type Exercise } from "@/lib/exercises";
import { searchCatalog, searchGymExercises } from "@/app/exercise-actions";
import { SearchSelect } from "@/components/search-select";

// Searchable grid of exercises with their animations.
// "catalog" = the whole library (adding machines); "gym" = what this gym has (programs).
export function ExercisePicker({
  source,
  selectedIds = [],
  onPick,
  pickLabel = "Add",
  initialQuery = "",
}: {
  source: "catalog" | "gym";
  selectedIds?: string[];
  onPick: (exercise: Exercise) => void;
  pickLabel?: string;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState(source === "catalog" ? "machine" : "");
  const [results, setResults] = useState<Exercise[] | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function run(next: { q?: string; muscle?: string; equipment?: string }) {
    const params = { q, muscle, equipment, ...next };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        setResults(
          source === "catalog"
            ? await searchCatalog(params.q, params.muscle, params.equipment)
            : await searchGymExercises(params.q, params.muscle),
        );
      });
    }, 200);
  }

  // First page of results (default filters) when the picker opens.
  useEffect(() => {
    startTransition(async () => {
      setResults(
        source === "catalog" ? await searchCatalog(initialQuery, "", "machine") : await searchGymExercises(initialQuery, ""),
      );
    });
  }, [source, initialQuery]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              run({ q: e.target.value });
            }}
            // The picker can sit inside a form (the program builder): Enter searches, never submits.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Search exercises, e.g. leg press"
            aria-label="Search exercises"
            className={`${inputClass} pl-9`}
          />
        </div>
        <SearchSelect
          value={muscle}
          onChange={(e) => {
            setMuscle(e.target.value);
            run({ muscle: e.target.value });
          }}
          aria-label="Muscle"
          className={inputWidth("w-auto")}
        >
          <option value="">All muscles</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {capitalize(m)}
            </option>
          ))}
        </SearchSelect>
        {source === "catalog" && (
          <SearchSelect
            value={equipment}
            onChange={(e) => {
              setEquipment(e.target.value);
              run({ equipment: e.target.value });
            }}
            aria-label="Equipment"
            className={inputWidth("w-auto")}
          >
            <option value="">Any equipment</option>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {capitalize(m)}
              </option>
            ))}
          </SearchSelect>
        )}
      </div>

      <div className={`grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 ${pending ? "opacity-60" : ""}`}>
        {results?.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-muted">
            {source === "gym"
              ? "No matching exercises with your gym's equipment. Tick more equipment or add machines under Equipment."
              : "No exercises found. Try another word or filter."}
          </p>
        )}
        {results?.map((ex) => {
          const picked = selectedIds.includes(ex.id);
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex)}
              className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                picked ? "border-ink bg-canvas" : "border-line hover:border-ink/40"
              }`}
            >
              <ExerciseAnimation paths={ex.image_paths} name={ex.name} className="size-16" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{ex.name}</span>
                <span className="block truncate text-xs text-muted">
                  {musclesLabel(ex.primary_muscles)} · {capitalize(ex.equipment ?? "other")}
                </span>
              </span>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full ${picked ? "bg-ink text-brand" : "bg-canvas text-muted"}`}
                aria-label={picked ? "Selected" : pickLabel}
              >
                {picked ? <Check className="size-4" /> : <Plus className="size-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
