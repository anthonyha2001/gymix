-- Members pause and resume their own membership from the portal. Same rules
-- as staff freezing: the paused days are added back to the end date on resume.
create function public.freeze_my_membership(p_gym_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms    public.memberships;
  v_today date := public.gym_today(p_gym_id);
begin
  select ms.* into v_ms
    from public.memberships ms
    join public.members m on m.id = ms.member_id
   where m.gym_id = p_gym_id and m.user_id = auth.uid()
     and ms.cancelled_at is null and ms.starts_on <= v_today
     and (ms.frozen_on is not null or ms.ends_on >= v_today)
   order by (ms.frozen_on is not null) desc, ms.ends_on desc
   limit 1
   for update of ms;
  if not found then
    raise exception 'No membership to pause' using errcode = 'P0002';
  end if;

  case p_action
    when 'freeze' then
      if v_ms.frozen_on is not null then
        raise exception 'Already paused' using errcode = '22023';
      end if;
      update public.memberships set frozen_on = v_today where id = v_ms.id;
    when 'unfreeze' then
      if v_ms.frozen_on is null then
        raise exception 'Not paused' using errcode = '22023';
      end if;
      update public.memberships
         set ends_on = ends_on + greatest(v_today - frozen_on, 0), frozen_on = null
       where id = v_ms.id;
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.freeze_my_membership(uuid, text) from public, anon;
grant execute on function public.freeze_my_membership(uuid, text) to authenticated;
