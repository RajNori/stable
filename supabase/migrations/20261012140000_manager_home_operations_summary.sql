-- Team Manager Home gets operational counts without exposing assignee or child data.

create or replace function public.read_team_manager_game_day_operations(
  p_event_id uuid
)
returns table (
  unassigned_duty_count integer,
  assigned_duty_count integer,
  acknowledged_duty_count integer,
  pending_duty_acknowledgement_count integer,
  open_duty_swap_count integer,
  open_fill_in_request_count integer,
  open_fill_in_response_count integer,
  confirmed_fill_in_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- `manual` is the existing exact-team boundary for Team Managers and Club
  -- Admins. Coaches and Guardians may read Game Day, but not this operations board.
  perform public.assert_fixture_team(event_row.team_id, 'manual');

  return query
  select
    count(*) filter (where assignment.id is null)::integer,
    count(assignment.id)::integer,
    count(assignment.id) filter (where assignment.acknowledged_at is not null)::integer,
    count(assignment.id) filter (where assignment.acknowledged_at is null)::integer,
    (
      select count(*)::integer
      from public.duty_swap_requests as request
      join public.duty_assignments as swap_assignment
        on swap_assignment.id = request.assignment_id
      join public.duties as swap_duty
        on swap_duty.id = swap_assignment.duty_id
      where swap_duty.event_id = event_row.id
        and request.status = 'OPEN'
    ),
    (
      select count(*) filter (where request.status = 'OPEN')::integer
      from public.fill_in_requests as request
      where request.event_id = event_row.id
    ),
    (
      select count(response.id)::integer
      from public.fill_in_requests as request
      join public.fill_in_responses as response
        on response.request_id = request.id
      where request.event_id = event_row.id
        and request.status = 'OPEN'
    ),
    (
      select count(*) filter (where request.status = 'CONFIRMED')::integer
      from public.fill_in_requests as request
      where request.event_id = event_row.id
    )
  from public.duties as duty
  left join public.duty_assignments as assignment
    on assignment.duty_id = duty.id
  where duty.event_id = event_row.id;
end;
$$;

revoke all on function public.read_team_manager_game_day_operations(uuid)
  from public, anon, authenticated;
grant execute on function public.read_team_manager_game_day_operations(uuid)
  to authenticated;
