-- M5B mobile RSVP read: return only the caller's managed-player statuses.
-- Private absence details and team-wide attendance remain staff-only.

create or replace function public.list_managed_attendance(p_event_id uuid)
returns table (player_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'read');

  return query
  select response.player_id, response.status
  from public.attendance_responses as response
  join public.guardian_relationships as relationship
    on relationship.player_id = response.player_id
    and relationship.club_id = response.club_id
  join public.player_team_registrations as registration
    on registration.player_id = response.player_id
    and registration.club_id = response.club_id
    and registration.team_id = event_row.team_id
  join public.players as player
    on player.id = response.player_id
    and player.club_id = response.club_id
  where response.event_id = event_row.id
    and relationship.user_id = actor
    and relationship.active
    and registration.active
    and player.active
  order by response.player_id;
end;
$$;

revoke all on function public.list_managed_attendance(uuid)
  from public, anon, authenticated;
grant execute on function public.list_managed_attendance(uuid) to authenticated;
