-- Acknowledgement must re-check that the caller can still take the duty.

create or replace function public.acknowledge_own_game_duty(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  updated_count integer := 0;
  assignment_row record;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if event_row.status <> 'SCHEDULED'
    or not exists (
      select 1
      from public.teams as team
      where team.id = event_row.team_id
        and team.club_id = event_row.club_id
        and team.active
    )
  then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.duty_assignments as assignment
    join public.duties as duty
      on duty.id = assignment.duty_id
    where duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.caller_can_take_duty(
    event_row.club_id,
    event_row.team_id,
    actor
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  for assignment_row in
    update public.duty_assignments as assignment
    set acknowledged_at = now()
    from public.duties as duty
    where duty.id = assignment.duty_id
      and duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
      and assignment.acknowledged_at is null
    returning assignment.duty_id
  loop
    updated_count := updated_count + 1;
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (event_row.club_id, actor, 'duty.acknowledged', assignment_row.duty_id);
  end loop;

  return updated_count;
end;
$$;
