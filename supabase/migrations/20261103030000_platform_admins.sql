-- Platform super admins: the people who run Gymix itself (not a gym).
-- They see platform-wide numbers per gym through admin_* functions only;
-- they get no access to gyms' member data through RLS.
-- Admins are added with web/scripts/create-super-admin.mjs (service role).

create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- One row per gym with health numbers for the platform console.
create function public.admin_gym_overview()
returns table (
  gym_id          uuid,
  name            text,
  created_at      timestamptz,
  owner_name      text,
  owner_email     text,
  staff           integer,
  members         integer,
  active_members  integer,
  checkins_30d    integer,
  collected_30d   numeric,
  last_checkin_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    g.id,
    g.name,
    g.created_at,
    op.full_name,
    op.email,
    (select count(*)::integer from public.gym_users gu where gu.gym_id = g.id and gu.role <> 'member'),
    (select count(*)::integer from public.members m where m.gym_id = g.id),
    (select count(distinct ms.member_id)::integer from public.memberships ms
      where ms.gym_id = g.id and ms.cancelled_at is null
        and public.membership_rank(ms, public.gym_today(g.id)) = 2),
    (select count(*)::integer from public.checkins c
      where c.gym_id = g.id and c.allowed and c.checked_in_at > now() - interval '30 days'),
    (select coalesce(sum(p.amount_usd), 0) from public.payments p
      where p.gym_id = g.id and p.paid_at > now() - interval '30 days'),
    (select max(c.checked_in_at) from public.checkins c where c.gym_id = g.id)
  from public.gyms g
  left join lateral (
    select pr.full_name, pr.email from public.gym_users gu
    join public.profiles pr on pr.id = gu.user_id
    where gu.gym_id = g.id and gu.role = 'owner'
    limit 1
  ) op on true
  order by g.created_at desc;
end;
$$;

revoke execute on function public.admin_gym_overview() from public, anon;
grant execute on function public.admin_gym_overview() to authenticated;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
