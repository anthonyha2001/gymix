-- Deleting your own account from inside the app (required by the App Store
-- and Google Play).
--
-- delete_my_account_data() removes the caller's personal app data, then the
-- server deletes the login itself (auth.users), which cascades to profiles,
-- gym_users and notifications. What a gym needs to keep for its business
-- (memberships, payments, invoices, check-ins, bookings, sales) stays on the
-- gym's member record, which is unlinked from the login.
--
-- Gym owners can't delete their account while they own a real gym: the gym
-- would be left without anyone able to run it.

create function public.account_deletion_blocker()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'You own ' || g.name || '. Hand the gym over to another owner, or ask Gymix to close it, before deleting your account.'
  from public.gym_users gu
  join public.gyms g on g.id = gu.gym_id
  where gu.user_id = auth.uid()
    and gu.role = 'owner'
    and not g.is_lab
    and not exists (
      select 1 from public.gym_users o
      where o.gym_id = gu.gym_id and o.role = 'owner' and o.user_id <> gu.user_id
    )
  order by g.created_at
  limit 1;
$$;

create function public.delete_my_account_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_blocker text;
  v_members uuid[];
  v_workouts integer;
  v_measurements integer;
begin
  if v_uid is null then
    raise exception 'Log in first';
  end if;
  v_blocker := public.account_deletion_blocker();
  if v_blocker is not null then
    raise exception '%', v_blocker;
  end if;

  select coalesce(array_agg(id), '{}') into v_members from public.members where user_id = v_uid;

  -- Personal training and health data.
  delete from public.workout_sessions where member_id = any (v_members);
  get diagnostics v_workouts = row_count;
  delete from public.body_measurements where member_id = any (v_members);
  get diagnostics v_measurements = row_count;
  delete from public.programs where member_id = any (v_members);
  delete from public.member_training_days where member_id = any (v_members);
  delete from public.program_requests where member_id = any (v_members);
  delete from public.nutrition_requests where member_id = any (v_members);
  delete from public.nutrition_plans where member_id = any (v_members);
  delete from public.challenge_entries where member_id = any (v_members);

  -- The gym keeps its member record (payments, visits) without the login.
  update public.members set user_id = null where id = any (v_members);

  return jsonb_build_object('members', coalesce(array_length(v_members, 1), 0), 'workouts', v_workouts, 'measurements', v_measurements);
end;
$$;

revoke execute on function public.account_deletion_blocker() from public, anon;
revoke execute on function public.delete_my_account_data() from public, anon;
grant execute on function public.account_deletion_blocker() to authenticated;
grant execute on function public.delete_my_account_data() to authenticated;
