-- Access-control tests for the foundation schema. Run via run_tests.sh.
-- Each block acts as one user (set role + JWT sub) and asserts what they can do.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

-- Users who exist before any gym does.
insert into auth.users (email, raw_user_meta_data) values
  ('alice@test.lb', '{"full_name":"Alice Owner"}'),
  ('carol@test.lb', '{"full_name":"Carol Member"}'),
  ('dave@test.lb',  '{"full_name":"Dave Outsider"}'),
  ('erin@test.lb',  '{"full_name":"Erin Manager"}');

do $$ begin
  assert (select count(*) from public.profiles) = 4, 'profiles created by trigger';
  assert (select full_name from public.profiles where email = 'alice@test.lb') = 'Alice Owner', 'name copied';
end $$;

-- Alice creates a gym and invites people.
select pg_temp.act_as('alice@test.lb');
select public.create_gym('Iron House Beirut') as gym_id \gset
do $$ begin
  assert (select slug from public.gyms) = 'iron-house-beirut', 'slug generated';
  assert public.my_gym_role((select id from public.gyms)) = 'owner', 'creator is owner';
end $$;

insert into public.invites (gym_id, email, role, invited_by)
select :'gym_id', e, r::public.gym_role, auth.uid()
from (values ('bob@test.lb', 'trainer'), ('carol@test.lb', 'member'), ('erin@test.lb', 'manager')) v(e, r);

-- Invite emails must be stored lowercased (the app lowercases before insert).
do $$ begin
  begin
    insert into public.invites (gym_id, email, role, invited_by)
    values ((select id from public.gyms), 'Mixed@Test.lb', 'member', auth.uid());
    assert false, 'mixed-case invite email should fail';
  exception when check_violation then null;
  end;
end $$;

-- Owner can't invite another owner (check constraint + policy).
do $$ begin
  begin
    insert into public.invites (gym_id, email, role, invited_by)
    values ((select id from public.gyms), 'x@test.lb', 'owner', auth.uid());
    assert false, 'owner invite should fail';
  exception when check_violation or insufficient_privilege then null;
  end;
end $$;
reset role;

-- Bob signs up after being invited (with different email casing): trigger claims the invite.
insert into auth.users (email, raw_user_meta_data) values ('Bob@Test.lb', '{"full_name":"Bob Trainer"}');
update auth.users set email = 'bob@test.lb' where email = 'Bob@Test.lb';
do $$ begin
  assert (select role from public.gym_users gu join public.profiles p on p.id = gu.user_id
          where p.email = 'bob@test.lb') = 'trainer', 'bob claimed trainer invite on signup';
end $$;

-- Carol and Erin already had accounts: they claim on next login.
select pg_temp.act_as('carol@test.lb');
do $$ begin assert public.claim_my_invites() = 1, 'carol claims 1 invite'; end $$;
reset role;
select pg_temp.act_as('erin@test.lb');
do $$ begin assert public.claim_my_invites() = 1, 'erin claims 1 invite'; end $$;
reset role;

-- Member: sees own row and own profile only; can't invite or edit roles.
select pg_temp.act_as('carol@test.lb');
do $$ begin
  assert (select count(*) from public.gym_users) = 1, 'member sees only own membership';
  assert (select count(*) from public.profiles) = 1, 'member sees only own profile';
  assert (select count(*) from public.invites) = 0, 'member sees no invites';
  assert (select count(*) from public.gyms) = 1, 'member sees their gym';
  begin
    insert into public.invites (gym_id, email, role, invited_by)
    values ((select id from public.gyms), 'y@test.lb', 'member', auth.uid());
    assert false, 'member invite should fail';
  exception when insufficient_privilege then null;
  end;
  update public.gym_users set role = 'manager' where user_id = auth.uid();
  assert public.my_gym_role((select id from public.gyms)) = 'member', 'member cannot promote self';
  update public.profiles set full_name = 'Hacked' where email = 'alice@test.lb';
  assert (select count(*) from public.profiles where full_name = 'Hacked') = 0, 'cannot edit others';
  update public.profiles set full_name = 'Carol M.' where id = auth.uid();
  assert (select full_name from public.profiles where id = auth.uid()) = 'Carol M.', 'can edit own profile';
end $$;
reset role;

-- Trainer: sees the roster, can't invite or manage anyone.
select pg_temp.act_as('bob@test.lb');
do $$ begin
  assert (select count(*) from public.gym_users) = 4, 'staff sees whole roster';
  assert (select count(*) from public.profiles) = 4, 'staff sees roster profiles';
  delete from public.gym_users where role = 'member';
  assert (select count(*) from public.gym_users) = 4, 'trainer cannot remove members';
end $$;
reset role;

-- Manager: can manage members/trainers but not the owner, and can't make managers.
select pg_temp.act_as('erin@test.lb');
do $$ begin
  begin
    update public.gym_users set role = 'manager'
     where user_id = (select id from public.profiles where email = 'bob@test.lb');
    assert false, 'manager promoting to manager should fail';
  exception when insufficient_privilege then null;
  end;
  assert (select role from public.gym_users gu join public.profiles p on p.id = gu.user_id
          where p.email = 'bob@test.lb') = 'trainer', 'manager cannot promote to manager';
  update public.gym_users set role = 'front_desk'
   where user_id = (select id from public.profiles where email = 'bob@test.lb');
  assert (select role from public.gym_users gu join public.profiles p on p.id = gu.user_id
          where p.email = 'bob@test.lb') = 'front_desk', 'manager can change trainer to front desk';
  delete from public.gym_users where role = 'owner';
  assert (select count(*) from public.gym_users where role = 'owner') = 1, 'nobody removes the owner';
end $$;
reset role;

-- Column grants: can't move a membership to another gym or rename via other columns.
select pg_temp.act_as('alice@test.lb');
do $$ begin
  begin
    update public.gym_users set gym_id = gen_random_uuid() where role = 'member';
    assert false, 'gym_id update should be denied';
  exception when insufficient_privilege then null;
  end;
  update public.gyms set name = 'Iron House' where true;
  assert (select name from public.gyms) = 'Iron House', 'owner renames gym';
  delete from public.gym_users where role = 'member';
  assert (select count(*) from public.gym_users where role = 'member') = 0, 'owner removes member';
end $$;
reset role;

-- Outsider: sees nothing of the gym.
select pg_temp.act_as('dave@test.lb');
do $$ begin
  assert (select count(*) from public.gyms) = 0, 'outsider sees no gyms';
  assert (select count(*) from public.gym_users) = 0, 'outsider sees no roster';
  assert (select count(*) from public.profiles) = 1, 'outsider sees only self';
  assert (select count(*) from public.invites) = 0, 'outsider sees no invites';
end $$;
reset role;

-- Anonymous: no direct table access, can't create gyms.
set role anon;
do $$ begin
  begin
    perform public.create_gym('Nope');
    assert false, 'anon create_gym should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Email change propagates to profile.
update auth.users set email = 'alice@new.lb' where email = 'alice@test.lb';
do $$ begin
  assert exists (select 1 from public.profiles where email = 'alice@new.lb'), 'email synced';
end $$;

\echo 'ALL RLS TESTS PASSED'
