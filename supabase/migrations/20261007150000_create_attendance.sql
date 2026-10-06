-- Slice 2.4 attendance. One row per player and event. Missing row stays unanswered.

alter table public.audit_events drop constraint audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'season.created',
      'season.updated',
      'competition.created',
      'competition.updated',
      'team.created',
      'team.updated',
      'venue.created',
      'venue.updated',
      'player.created',
      'player.imported',
      'player.updated',
      'player.deactivated',
      'player.reactivated',
      'guardian.linked',
      'guardian.unlinked',
      'team_staff.assigned',
      'team_staff.revoked',
      'team_staff.reactivated',
      'player_team.registered',
      'player_team.unregistered',
      'invitation.created',
      'invitation.revoked',
      'invitation.accepted',
      'fixture.created',
      'fixture.imported',
      'fixture.official_updated',
      'fixture.overlay_updated',
      'duty.assigned',
      'attendance.recorded'
    )
  );

create table public.attendance_responses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  event_id uuid not null references public.events (id),
  player_id uuid not null references public.players (id),
  status text not null,
  absence_category text,
  private_note text,
  responded_by_user_id uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint attendance_responses_team_same_club foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint attendance_responses_event_player unique (event_id, player_id),
  constraint attendance_responses_status_check check (
    status in ('ATTENDING', 'UNAVAILABLE', 'UNSURE')
  ),
  constraint attendance_responses_category_check check (
    absence_category is null
    or absence_category in ('SICK', 'INJURY', 'FAMILY', 'OTHER')
  ),
  constraint attendance_responses_category_status_check check (
    absence_category is null or status = 'UNAVAILABLE'
  ),
  constraint attendance_responses_note_check check (
    private_note is null
    or (
      char_length(private_note) between 1 and 500
      and private_note = btrim(private_note)
      and private_note !~ '[[:cntrl:]]'
    )
  )
);

create index attendance_responses_team_event_idx
  on public.attendance_responses (team_id, event_id);

alter table public.attendance_responses enable row level security;
alter table public.attendance_responses force row level security;
revoke all on table public.attendance_responses from public, anon, authenticated;
grant select, insert, update, delete on table public.attendance_responses to service_role;

create or replace function public.caller_manages_player(
  p_club_id uuid,
  p_team_id uuid,
  p_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_relationships as relationship
    join public.player_team_registrations as registration
      on registration.player_id = relationship.player_id
      and registration.club_id = relationship.club_id
    join public.players as player
      on player.id = relationship.player_id
    where relationship.user_id = (select auth.uid())
      and relationship.club_id = p_club_id
      and relationship.player_id = p_player_id
      and relationship.active
      and registration.team_id = p_team_id
      and registration.active
      and player.active
      and player.club_id = p_club_id
  );
$$;

create or replace function public.record_attendance(
  p_event_id uuid,
  p_player_id uuid,
  p_status text,
  p_absence_category text,
  p_private_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  normalized_note text;
  response_id uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.caller_manages_player(event_row.club_id, event_row.team_id, p_player_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_status not in ('ATTENDING', 'UNAVAILABLE', 'UNSURE') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_absence_category is not null
    and (
      p_status <> 'UNAVAILABLE'
      or p_absence_category not in ('SICK', 'INJURY', 'FAMILY', 'OTHER')
    )
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  normalized_note := public.fixture_text(p_private_note, 500, false);

  insert into public.attendance_responses (
    club_id,
    team_id,
    event_id,
    player_id,
    status,
    absence_category,
    private_note,
    responded_by_user_id
  )
  values (
    event_row.club_id,
    event_row.team_id,
    event_row.id,
    p_player_id,
    p_status,
    p_absence_category,
    normalized_note,
    actor
  )
  on conflict (event_id, player_id) do update
  set
    status = excluded.status,
    absence_category = excluded.absence_category,
    private_note = excluded.private_note,
    responded_by_user_id = excluded.responded_by_user_id,
    updated_at = now()
  returning id into response_id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'attendance.recorded', response_id);

  return response_id;
end;
$$;

create or replace function public.list_team_attendance(p_event_id uuid)
returns table (
  player_id uuid,
  status text,
  absence_category text,
  private_note text
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
  where event.id = p_event_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  staff := public.caller_is_club_admin(event_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = event_row.team_id
        and membership.club_id = event_row.club_id
        and membership.user_id = actor
        and membership.active
    );

  if not staff then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    response.player_id,
    response.status,
    response.absence_category,
    response.private_note
  from public.attendance_responses as response
  where response.event_id = event_row.id
  order by response.player_id;
end;
$$;

create or replace function public.read_game_day(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  opponent_name text,
  round_label text,
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
  unanswered_count integer
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
    ) else null end
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

revoke all on function public.caller_manages_player(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.record_attendance(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.list_team_attendance(uuid)
  from public, anon, authenticated;
grant execute on function public.record_attendance(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.list_team_attendance(uuid) to authenticated;
