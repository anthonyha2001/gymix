-- Saving the equipment list with nothing ticked failed: array_agg over no rows
-- is NULL, which the NOT NULL column refuses ("Couldn't save your equipment").
create or replace function public.set_gym_equipment(p_gym_id uuid, p_equipment text[])
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
  update public.gyms
     set equipment = coalesce((select array_agg(distinct e) from unnest(p_equipment) e), '{}')
   where id = p_gym_id;
end;
$$;
