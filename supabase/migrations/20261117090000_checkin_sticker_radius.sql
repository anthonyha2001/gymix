-- "Phone must be at the gym" now covers the entrance check-in sticker too:
-- when the gym set a distance (door_radius_m, 150 m by default), a tap only
-- checks the member in if their phone is within it. Without one, the sticker
-- works wherever the phone is, as before.

drop function if exists public.self_check_in(text);

create function public.self_check_in(p_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy_m double precision default null)
returns table (
  allowed boolean, already_in boolean, reason text, member_id uuid, full_name text,
  plan_name text, ends_on date, visits_left integer, balance_usd numeric
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_gym       public.gyms;
  v_member_id uuid;
  v_away      double precision;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_gym from public.gyms g where g.checkin_token = p_token;
  if not found then
    raise exception 'This check-in link is no longer valid. Ask the front desk.' using errcode = 'P0002';
  end if;

  select m.id into v_member_id from public.members m where m.gym_id = v_gym.id and m.user_id = auth.uid();
  if v_member_id is null then
    raise exception 'Your account isn''t linked to a membership at this gym. Ask the front desk.' using errcode = 'P0002';
  end if;

  if v_gym.door_radius_m is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location for Gymix: check-in only works when your phone is at the gym.' using errcode = '22023';
    end if;
    -- Allows for the phone's accuracy, up to 150 m of it.
    v_away := public.distance_m(v_gym.door_lat, v_gym.door_lng, p_lat, p_lng) - least(greatest(coalesce(p_accuracy_m, 0), 0), 150);
    if v_away > v_gym.door_radius_m then
      raise exception 'Your phone isn''t at the gym. Tap the sticker when you''re there.' using errcode = '22023';
    end if;
  end if;

  return query select * from public.record_check_in(v_gym.id, v_member_id, 'tap');
end;
$$;

revoke execute on function public.self_check_in(text, double precision, double precision, double precision) from public, anon;
grant execute on function public.self_check_in(text, double precision, double precision, double precision) to authenticated;

-- The check-in page asks for the phone's location only when the gym needs it.
create function public.checkin_needs_location(p_token text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select g.door_radius_m is not null from public.gyms g where g.checkin_token = p_token), false);
$$;

revoke execute on function public.checkin_needs_location(text) from public, anon;
grant execute on function public.checkin_needs_location(text) to authenticated;
