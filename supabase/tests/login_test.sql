-- Member login lookup: email, phone (any format) or member code -> account email.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('owner-l@test.lb', '{"full_name":"Owner L"}'),
  ('member-x@members.gymix.invalid', '{"full_name":"Link Member"}'),
  ('twin-a@test.lb', '{"full_name":"Twin A"}'),
  ('twin-b@test.lb', '{"full_name":"Twin B"}');

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'owner-l@test.lb'), false);
set role authenticated;
select public.create_gym('Login Gym') as gym \gset
reset role;

insert into public.members (gym_id, full_name, phone, user_id, checkin_code) values
  (:'gym', 'Link Member', '71 123 456', (select id from auth.users where email = 'member-x@members.gymix.invalid'), 'ABC123XYZ0'),
  (:'gym', 'Twin A', '03 999 888', (select id from auth.users where email = 'twin-a@test.lb'), 'TWINA00001'),
  (:'gym', 'Twin B', '+961 3 999 888', (select id from auth.users where email = 'twin-b@test.lb'), 'TWINB00001'),
  (:'gym', 'No Account', '76 000 111', null, 'NOACC00001');

select pg_temp.ok(public.normalize_phone('+961 71 123 456') = '71123456', 'normalises +961');
select pg_temp.ok(public.normalize_phone('071-123-456') = '71123456', 'normalises leading 0');
select pg_temp.ok(public.member_login_email('Some@Mail.com') = 'some@mail.com', 'email passes through');
select pg_temp.ok(public.member_login_email('71123456') = 'member-x@members.gymix.invalid', 'phone finds the account');
select pg_temp.ok(public.member_login_email('+961 71 123 456') = 'member-x@members.gymix.invalid', 'phone in another format');
select pg_temp.ok(public.member_login_email('abc123xyz0') = 'member-x@members.gymix.invalid', 'member code, any case');
select pg_temp.ok(public.member_login_email('03999888') is null, 'a phone on two accounts is ambiguous');
select pg_temp.ok(public.member_login_email('TWINA00001') = 'twin-a@test.lb', 'member code resolves the ambiguity');
select pg_temp.ok(public.member_login_email('76000111') is null, 'no account, no login');
select pg_temp.ok(public.member_login_email('') is null, 'empty');

-- Signed-in users can't call it (no looking people up).
set role authenticated;
do $$
begin
  perform public.member_login_email('71123456');
  raise exception 'expected failure';
exception when insufficient_privilege then null;
end;
$$;
reset role;

\echo 'ALL LOGIN TESTS PASSED'
