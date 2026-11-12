-- Machine stickers: who can mark them set up, and taps proving they work.
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

create or replace function pg_temp.fails(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected failure but succeeded: %', p_sql;
exception when others then
  if sqlerrm like 'expected failure%' then raise; end if;
  return sqlerrm;
end;
$$;

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$
  select current_setting('t.' || p_key)::uuid
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('st-owner@test.lb', '{"full_name":"Owner St"}'),
  ('st-desk@test.lb', '{"full_name":"Desk St"}'),
  ('st-nour@test.lb', '{"full_name":"Nour St"}'),
  ('st-other@test.lb', '{"full_name":"Other St"}');

select pg_temp.act_as('st-owner@test.lb');
select set_config('t.gym', public.create_gym('Sticker Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'st-desk@test.lb', 'front_desk', auth.uid());
insert into public.gym_machines (gym_id, name, created_by) values (pg_temp.v('gym'), 'Leg press', auth.uid());
select set_config('t.m', (select id::text from public.gym_machines where name = 'Leg press'), false);
reset role;
select pg_temp.act_as('st-desk@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('st-other@test.lb'); select public.create_gym('Other St Gym'); reset role;
insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour St', '70400001', (select id from auth.users where email = 'st-nour@test.lb'));
insert into public.gym_users (gym_id, user_id, role) values (pg_temp.v('gym'), (select id from auth.users where email = 'st-nour@test.lb'), 'member');

-- Owner marks it written; nothing else can be changed through that grant.
select pg_temp.act_as('st-owner@test.lb');
update public.gym_machines set sticker_at = now() where id = pg_temp.v('m');
select pg_temp.ok((select sticker_at is not null from public.gym_machines where id = pg_temp.v('m')), 'owner marks sticker');
select pg_temp.ok(pg_temp.fails(format('update public.gym_machines set sticker_tapped_at = now() where id = %L', pg_temp.v('m'))) like '%permission denied%', 'tapped_at not writable');
update public.gym_machines set sticker_at = null where id = pg_temp.v('m');
reset role;

-- Front desk can't change it (RLS: no rows updated).
select pg_temp.act_as('st-desk@test.lb');
update public.gym_machines set sticker_at = now() where id = pg_temp.v('m');
reset role;
select pg_temp.ok((select sticker_at is null from public.gym_machines where id = pg_temp.v('m')), 'front desk cannot mark');

-- Someone from another gym taps: nothing happens.
select pg_temp.act_as('st-other@test.lb'); select public.machine_sticker_tapped(pg_temp.v('m')); reset role;
select pg_temp.ok((select sticker_tapped_at is null from public.gym_machines where id = pg_temp.v('m')), 'outsider tap ignored');

-- A member taps: proves the sticker works, and counts as set up.
select pg_temp.act_as('st-nour@test.lb'); select public.machine_sticker_tapped(pg_temp.v('m')); reset role;
select pg_temp.ok((select sticker_tapped_at is not null and sticker_at is not null from public.gym_machines where id = pg_temp.v('m')), 'member tap recorded');

-- Again within the hour: not rewritten.
update public.gym_machines set sticker_tapped_at = now() - interval '10 minutes' where id = pg_temp.v('m');
select set_config('t.before', (select sticker_tapped_at::text from public.gym_machines where id = pg_temp.v('m')), false);
select pg_temp.act_as('st-nour@test.lb'); select public.machine_sticker_tapped(pg_temp.v('m')); reset role;
select pg_temp.ok((select sticker_tapped_at::text = current_setting('t.before') from public.gym_machines where id = pg_temp.v('m')), 'throttled to once an hour');

-- Anonymous visitors can't call it.
set role anon;
select pg_temp.ok(pg_temp.fails(format('select public.machine_sticker_tapped(%L)', pg_temp.v('m'))) like '%permission denied%', 'anon cannot call');
reset role;

select 'machine stickers: all passed' as result;
