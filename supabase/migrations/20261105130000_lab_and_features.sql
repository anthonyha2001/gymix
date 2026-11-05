-- The super admin's lab: a test gym, entering any gym as any role, and
-- feature switches (off / lab only / everyone, plus per-gym exceptions).

-- Support access now has a role: the super admin sees the gym as that role.
alter table public.platform_admin_visits add column role public.gym_role not null default 'owner';

create or replace function public.my_gym_role(p_gym_id uuid)
returns public.gym_role
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.gym_users where gym_id = p_gym_id and user_id = auth.uid()),
    (select v.role from public.platform_admin_visits v
      where v.user_id = auth.uid() and v.gym_id = p_gym_id and public.is_platform_admin())
  )
$$;

-- Lab gyms get features set to "lab only" first, and are left out of business numbers.
alter table public.gyms add column is_lab boolean not null default false;

-- Feature switches. rollout: 'off' (nobody), 'lab' (lab gyms only), 'all' (everyone).
create table public.features (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name         text not null,
  description  text not null default '',
  rollout      text not null default 'lab' check (rollout in ('off', 'lab', 'all')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.features enable row level security;
create policy "Anyone signed in reads features" on public.features for select to authenticated using (true);

-- A gym that gets a feature early, or doesn't get it at all, whatever the rollout.
create table public.gym_feature_overrides (
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  feature_key  text not null references public.features (key) on delete cascade on update cascade,
  enabled      boolean not null,
  primary key (gym_id, feature_key)
);
alter table public.gym_feature_overrides enable row level security;
create policy "Super admins read overrides" on public.gym_feature_overrides
  for select to authenticated using (public.is_platform_admin());

-- The features on for one gym.
create function public.gym_features(p_gym_id uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(f.key), '{}')
    from public.features f
    join public.gyms g on g.id = p_gym_id
    left join public.gym_feature_overrides o on o.gym_id = g.id and o.feature_key = f.key
   where coalesce(o.enabled, f.rollout = 'all' or (f.rollout = 'lab' and g.is_lab))
$$;
revoke all on function public.gym_features(uuid) from public, anon;
grant execute on function public.gym_features(uuid) to authenticated, service_role;

-- What's live today, so nothing changes for existing gyms.
insert into public.features (key, name, description, rollout) values
  ('whatsapp', 'Automatic WhatsApp', 'Renewal reminders, payment receipts and new-member login links.', 'all'),
  ('shake_to_open', 'Shake to open programs', 'Members shake the phone three times to open their programs.', 'all'),
  ('drop_animation', 'Dropped-phone animation', 'A cracked-screen joke when a member drops the phone.', 'all'),
  ('self_pause', 'Members pause themselves', 'Members pause and resume their own membership from Home.', 'all');

-- gyms has per-column grants: let staff read the lab flag, and read and change
-- the WhatsApp reminder days (added in 20261105100000 without a grant).
grant select (is_lab) on public.gyms to authenticated;
grant select (renewal_reminder_days), update (renewal_reminder_days) on public.gyms to authenticated;
