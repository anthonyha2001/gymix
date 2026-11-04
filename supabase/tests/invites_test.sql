-- Invite link tests.
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

insert into auth.users (email, raw_user_meta_data) values
  ('o5@test.lb', '{"full_name":"Owner Five"}'),
  ('rami.personal@test.lb', '{"full_name":"Rami H"}'),
  ('thief@test.lb', '{"full_name":"Thief"}');

select pg_temp.act_as('o5@test.lb');
select public.create_gym('Gym Five') as gym \gset
-- A walk-in with a phone number only, no email.
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Rami Haddad', '71 123 456', auth.uid());
select id as rami from public.members where full_name = 'Rami Haddad' \gset
select public.member_invite_token(:'rami') as tok \gset
select pg_temp.ok(public.member_invite_token(:'rami') = :'tok', 'same live link is reused');
reset role;

-- Anyone with the link sees the preview (no account needed).
set role anon;
select pg_temp.ok((select gym_name = 'Gym Five' and member_name = 'Rami Haddad' and not expired and not accepted
                    from public.invite_preview(:'tok')), 'anonymous preview');
select pg_temp.fails(format('select public.accept_invite(%L)', :'tok')) as anon_accept \gset
\echo anonymous cannot accept: :anon_accept
reset role;

-- Rami signs up with an email the gym never had, then accepts the link.
select pg_temp.act_as('rami.personal@test.lb');
select pg_temp.ok(public.accept_invite(:'tok') = 'member', 'accepted as member');
select pg_temp.ok((select count(*) from public.members) = 1, 'sees exactly his membership');
reset role;
select pg_temp.ok((select user_id from public.members where id = :'rami') = (select id from auth.users where email = 'rami.personal@test.lb'), 'linked to the right record');
select pg_temp.ok((select count(*) from public.members where gym_id = :'gym') = 1, 'no duplicate member record');

-- The used link can't be reused by someone else.
select pg_temp.act_as('thief@test.lb');
select pg_temp.fails(format('select public.accept_invite(%L)', :'tok')) as reuse \gset
\echo used link rejected: :reuse
select pg_temp.fails('select public.accept_invite(''nonsense'')') as bogus \gset
\echo bogus link rejected: :bogus
reset role;

-- Accepting again as Rami is harmless.
select pg_temp.act_as('rami.personal@test.lb');
select pg_temp.ok(public.accept_invite(:'tok') = 'member', 'idempotent for the same person');
reset role;

-- Expired links are refused; members with portal access get no new link.
select pg_temp.act_as('o5@test.lb');
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Late Larry', auth.uid());
select public.member_invite_token((select id from public.members where full_name = 'Late Larry')) as late \gset
select pg_temp.fails(format('select public.member_invite_token(%L)', :'rami')) as already \gset
\echo no link for linked member: :already
reset role;
update public.invites set expires_at = now() - interval '1 day' where token = :'late';
select pg_temp.act_as('thief@test.lb');
select pg_temp.fails(format('select public.accept_invite(%L)', :'late')) as expired \gset
\echo expired link rejected: :expired
reset role;

\echo 'ALL INVITE TESTS PASSED'
