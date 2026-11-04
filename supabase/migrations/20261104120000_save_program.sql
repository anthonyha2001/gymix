-- Saves a whole program (name, notes, days and their exercises) in one call,
-- so the builder can edit everything in the browser and save once.
--
-- Rows keep their ids: existing days and exercises are updated in place
-- (logged workouts point at them), new ones are inserted, and the ones left
-- out are deleted. Runs as the caller, so the usual program permissions
-- (can_edit_program, via RLS and column grants) apply to every write.
--
-- p_program: {"name", "notes", "days": [{"id"?, "name", "exercises": [
--   {"id"?, "exercise_id", "sets", "reps", "target_weight_kg", "rest_seconds", "notes"}]}]}

create function public.save_program(p_program_id uuid, p_program jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_day      jsonb;
  v_ex       jsonb;
  v_day_id   uuid;
  v_day_pos  integer := 0;
  v_ex_pos   integer;
  v_keep_days uuid[];
  v_keep_ex   uuid[];
begin
  if not public.can_edit_program(p_program_id) then
    raise exception 'You can''t edit this program' using errcode = '42501';
  end if;

  update public.programs
     set name = trim(p_program->>'name'),
         notes = nullif(trim(coalesce(p_program->>'notes', '')), '')
   where id = p_program_id;

  -- Ids the payload keeps (only those that really belong to this program).
  select coalesce(array_agg(d.id), '{}') into v_keep_days
    from public.program_days d
   where d.program_id = p_program_id
     and d.id::text in (select x->>'id' from jsonb_array_elements(coalesce(p_program->'days', '[]')) x);
  select coalesce(array_agg(pe.id), '{}') into v_keep_ex
    from public.program_exercises pe
    join public.program_days d on d.id = pe.day_id
   where d.program_id = p_program_id
     and pe.id::text in (
       select e->>'id'
         from jsonb_array_elements(coalesce(p_program->'days', '[]')) x,
              jsonb_array_elements(coalesce(x->'exercises', '[]')) e
     );

  -- Remove what was taken out.
  delete from public.program_exercises pe
   using public.program_days d
   where d.id = pe.day_id and d.program_id = p_program_id and pe.id <> all (v_keep_ex);
  delete from public.program_days
   where program_id = p_program_id and id <> all (v_keep_days);

  for v_day in select * from jsonb_array_elements(coalesce(p_program->'days', '[]')) loop
    v_day_pos := v_day_pos + 1;
    v_day_id := nullif(v_day->>'id', '')::uuid;
    if v_day_id = any (v_keep_days) then
      update public.program_days set name = trim(v_day->>'name'), position = v_day_pos where id = v_day_id;
    else
      insert into public.program_days (program_id, position, name)
      values (p_program_id, v_day_pos, trim(v_day->>'name'))
      returning id into v_day_id;
    end if;

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]')) loop
      v_ex_pos := v_ex_pos + 1;
      if nullif(v_ex->>'id', '')::uuid = any (v_keep_ex)
         and exists (select 1 from public.program_exercises where id = (v_ex->>'id')::uuid and day_id = v_day_id) then
        update public.program_exercises
           set position = v_ex_pos,
               exercise_id = v_ex->>'exercise_id',
               sets = (v_ex->>'sets')::integer,
               reps = trim(v_ex->>'reps'),
               target_weight_kg = nullif(v_ex->>'target_weight_kg', '')::numeric,
               rest_seconds = (v_ex->>'rest_seconds')::integer,
               notes = nullif(trim(coalesce(v_ex->>'notes', '')), '')
         where id = (v_ex->>'id')::uuid;
      else
        insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes)
        values (
          v_day_id, v_ex_pos, v_ex->>'exercise_id', (v_ex->>'sets')::integer, trim(v_ex->>'reps'),
          nullif(v_ex->>'target_weight_kg', '')::numeric, (v_ex->>'rest_seconds')::integer,
          nullif(trim(coalesce(v_ex->>'notes', '')), '')
        );
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.save_program(uuid, jsonb) from public, anon;
grant execute on function public.save_program(uuid, jsonb) to authenticated;
