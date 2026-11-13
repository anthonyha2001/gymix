-- Remove the old free-exercise-db photo library (876 exercises). The Gymix
-- motion library (source 'gymix-motion') replaces it. Everything that used an
-- old exercise is deleted with it: program exercises, workout exercises and
-- set logs. Personal bests (exercise_bests) are a view over set_logs.

update public.program_exercises
   set swapped_from = null
 where swapped_from in (select id from public.exercises where source = 'free-exercise-db');

delete from public.set_logs
 where exercise_id in (select id from public.exercises where source = 'free-exercise-db');

delete from public.workout_exercises
 where exercise_id in (select id from public.exercises where source = 'free-exercise-db');

delete from public.program_exercises
 where exercise_id in (select id from public.exercises where source = 'free-exercise-db');

-- machine_exercises rows go with them (on delete cascade).
delete from public.exercises where source = 'free-exercise-db';

alter table public.exercises alter column source set default 'gymix-motion';
