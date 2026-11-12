-- Machine stickers: know which machines have their NFC sticker.
--   sticker_at        set when staff write the sticker from Gymix (Android) or
--                     tick "Done" after writing it with another app (iPhone).
--   sticker_tapped_at the last time someone opened the machine from the
--                     sticker itself (the written link ends in ?n=1), which
--                     proves the sticker works. Updated at most once an hour.

alter table public.gym_machines
  add column sticker_at timestamptz,
  add column sticker_tapped_at timestamptz;

-- Owners and managers set it (machines_update already limits rows to them).
grant update (sticker_at) on public.gym_machines to authenticated;

create function public.machine_sticker_tapped(p_machine_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.gym_machines
     set sticker_tapped_at = now(),
         sticker_at = coalesce(sticker_at, now())
   where id = p_machine_id
     and public.my_gym_role(gym_id) is not null
     and (sticker_tapped_at is null or sticker_tapped_at < now() - interval '1 hour');
$$;

revoke execute on function public.machine_sticker_tapped(uuid) from public, anon;
grant execute on function public.machine_sticker_tapped(uuid) to authenticated;
