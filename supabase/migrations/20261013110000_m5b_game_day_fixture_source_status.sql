-- Include only safe fixture provenance and lifecycle facts in the existing
-- caller-authorized Game Day projection. Do not expose provider identifiers.
drop function public.read_game_day(uuid);

create function public.read_game_day(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  opponent_name text,
  round_label text,
  fixture_source text,
  fixture_status text,
  official_start_at timestamptz,
  arrival_at timestamptz,
  venue_text text,
  court_label text,
  uniform_note text,
  coach_focus text,
  own_rsvp text,
  own_duty_label text,
  own_duty_status text,
  attending_count integer,
  unavailable_count integer,
  unsure_count integer,
  unanswered_count integer,
  fill_in_label text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  staff boolean;
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
  staff := public.caller_is_club_admin(event_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = event_row.team_id
        and membership.club_id = event_row.club_id
        and membership.user_id = actor
        and membership.active
    );

  return query
  select
    event_row.id,
    event_row.club_id,
    event_row.team_id,
    game.opponent_name,
    game.round_label,
    game.source,
    game.fixture_status,
    game.official_start_at,
    overlay.arrival_at,
    game.official_venue_text,
    game.official_court_label,
    overlay.uniform_note,
    overlay.coach_focus,
    coalesce((
      select response.status
      from public.attendance_responses as response
      join public.guardian_relationships as relationship
        on relationship.player_id = response.player_id
        and relationship.club_id = response.club_id
      join public.player_team_registrations as registration
        on registration.player_id = response.player_id
        and registration.team_id = event_row.team_id
      join public.players as player
        on player.id = response.player_id
      where response.event_id = event_row.id
        and relationship.user_id = actor
        and relationship.active
        and registration.active
        and player.active
      order by response.player_id
      limit 1
    ), 'UNANSWERED'),
    own_duty.label,
    own_duty.status,
    case when staff then (
      select count(*)::integer
      from public.player_team_registrations as registration
      join public.players as player on player.id = registration.player_id
      join public.attendance_responses as response
        on response.player_id = registration.player_id
        and response.event_id = event_row.id
        and response.status = 'ATTENDING'
      where registration.team_id = event_row.team_id
        and registration.active
        and player.active
    ) else null end,
    case when staff then (
      select count(*)::integer
      from public.player_team_registrations as registration
      join public.players as player on player.id = registration.player_id
      join public.attendance_responses as response
        on response.player_id = registration.player_id
        and response.event_id = event_row.id
        and response.status = 'UNAVAILABLE'
      where registration.team_id = event_row.team_id
        and registration.active
        and player.active
    ) else null end,
    case when staff then (
      select count(*)::integer
      from public.player_team_registrations as registration
      join public.players as player on player.id = registration.player_id
      join public.attendance_responses as response
        on response.player_id = registration.player_id
        and response.event_id = event_row.id
        and response.status = 'UNSURE'
      where registration.team_id = event_row.team_id
        and registration.active
        and player.active
    ) else null end,
    case when staff then (
      select count(*)::integer
      from public.player_team_registrations as registration
      join public.players as player on player.id = registration.player_id
      where registration.team_id = event_row.team_id
        and registration.active
        and player.active
        and not exists (
          select 1
          from public.attendance_responses as response
          where response.event_id = event_row.id
            and response.player_id = registration.player_id
        )
    ) else null end,
    (
      select public.masked_player_name(confirmation.player_id)
      from public.fill_in_confirmations as confirmation
      join public.fill_in_requests as fill_request
        on fill_request.id = confirmation.request_id
      where fill_request.event_id = event_row.id
        and fill_request.status = 'CONFIRMED'
      order by confirmation.created_at
      limit 1
    )
  from public.games as game
  join public.game_team_overlay as overlay
    on overlay.game_event_id = game.event_id
  left join lateral (
    select duty.label, assignment.status
    from public.duties as duty
    join public.duty_assignments as assignment
      on assignment.duty_id = duty.id
    where duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
    order by duty.created_at
    limit 1
  ) as own_duty on true
  where game.event_id = event_row.id;
end;
$$;

revoke all on function public.read_game_day(uuid) from public, anon, authenticated;
grant execute on function public.read_game_day(uuid) to authenticated;
