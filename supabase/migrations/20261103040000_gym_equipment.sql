-- Free equipment: a gym ticks the equipment types it has (dumbbells, barbells,
-- cables…) and every exercise for that equipment becomes available. Specific
-- machines still come from gym_machines, since gyms differ in which they own.

alter table public.gyms
  add column equipment text[] not null default array[
    'body only', 'dumbbell', 'barbell', 'cable', 'kettlebells', 'e-z curl bar',
    'bands', 'medicine ball', 'exercise ball', 'foam roll'
  ];
grant select (equipment) on public.gyms to authenticated;

-- Owners and managers set it (gyms rows are otherwise owner-only to update).
create function public.set_gym_equipment(p_gym_id uuid, p_equipment text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_equipment) e
    where e not in ('body only', 'dumbbell', 'barbell', 'cable', 'kettlebells', 'e-z curl bar',
                    'bands', 'medicine ball', 'exercise ball', 'foam roll', 'other')
  ) then
    raise exception 'Unknown equipment type' using errcode = '22023';
  end if;
  update public.gyms set equipment = (select array_agg(distinct e) from unnest(p_equipment) e) where id = p_gym_id;
end;
$$;

revoke execute on function public.set_gym_equipment(uuid, text[]) from public, anon;
grant execute on function public.set_gym_equipment(uuid, text[]) to authenticated;

-- Available = exercises for equipment the gym has ticked (no equipment listed
-- counts as bodyweight) + exercises on its registered machines.
create or replace view public.gym_exercises with (security_invoker = true) as
select g.id as gym_id, e.*
from public.gyms g
join public.exercises e
  on (coalesce(e.equipment, 'body only') <> 'machine' and coalesce(e.equipment, 'body only') = any (g.equipment))
  or exists (
    select 1 from public.machine_exercises me
    join public.gym_machines gm on gm.id = me.machine_id
    where gm.gym_id = g.id and me.exercise_id = e.id
  );
