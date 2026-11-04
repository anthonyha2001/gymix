-- Automatic WhatsApp messages (sent from the one Gymix number): renewal
-- reminders, payment receipts and new-member logins.

-- Days before a membership ends to remind the member (0 = no reminders).
alter table public.gyms
  add column renewal_reminder_days integer not null default 3
  check (renewal_reminder_days between 0 and 30);

-- One row per message: (kind, ref) is unique so nothing is sent twice.
create table public.whatsapp_log (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  member_id  uuid references public.members (id) on delete set null,
  kind       text not null check (kind in ('renewal', 'payment', 'welcome')),
  ref        text not null,
  status     text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error      text,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index whatsapp_log_gym_idx on public.whatsapp_log (gym_id, created_at desc);
alter table public.whatsapp_log enable row level security;
create policy "Staff read their gym's WhatsApp log" on public.whatsapp_log
  for select to authenticated using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

-- Memberships ending exactly renewal_reminder_days from today (gym time), for
-- members with a phone and no later membership already sold. Server only.
create function public.renewal_reminders_due()
returns table (
  gym_id        uuid,
  gym_name      text,
  member_id     uuid,
  full_name     text,
  phone         text,
  membership_id uuid,
  ends_on       date
)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, m.id, m.full_name, m.phone, ms.id, ms.ends_on
    from public.gyms g
    join public.members m on m.gym_id = g.id
    join public.memberships ms on ms.member_id = m.id
   where g.renewal_reminder_days > 0 and m.archived_at is null
     and m.phone is not null and m.phone <> ''
     and ms.cancelled_at is null and ms.frozen_on is null
     and ms.ends_on = public.gym_today(g.id) + g.renewal_reminder_days
     and not exists (
       select 1 from public.memberships later
        where later.member_id = m.id and later.cancelled_at is null and later.ends_on > ms.ends_on
     );
$$;
revoke all on function public.renewal_reminders_due() from public, anon, authenticated;
grant execute on function public.renewal_reminders_due() to service_role;
