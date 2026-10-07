-- Slice 3.5 fill-ins. Masked candidates, one confirmation, no official fixture changes.

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
      'attendance.recorded',
      'training.created',
      'training.series_created',
      'training.updated',
      'training.checked_in',
      'announcement.published',
      'announcement.updated',
      'announcement.archived',
      'announcement.acknowledged',
      'duty.acknowledged',
      'duty.allocated',
      'duty.swap_requested',
      'duty.swap_accepted',
      'duty.swap_cancelled',
      'fill_in.requested',
      'fill_in.responded',
      'fill_in.confirmed'
    )
  );

create table public.fill_in_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  team_id uuid not null,
  event_id uuid not null references public.events (id),
  requested_by uuid not null references public.profiles (user_id),
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  constraint fill_in_requests_team_club_fkey
    foreign key (team_id, club_id) references public.teams (id, club_id),
  constraint fill_in_requests_status_check check (
    status in ('OPEN', 'WITHDRAWN', 'CONFIRMED')
  )
);

create unique index fill_in_requests_one_open
  on public.fill_in_requests (event_id)
  where status = 'OPEN';

create table public.fill_in_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fill_in_requests (id),
  player_id uuid not null references public.players (id),
  guardian_user_id uuid not null references public.profiles (user_id),
  created_at timestamptz not null default now(),
  constraint fill_in_responses_once unique (request_id, guardian_user_id, player_id)
);

create table public.fill_in_confirmations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.fill_in_requests (id),
  player_id uuid not null references public.players (id),
  confirmed_by uuid not null references public.profiles (user_id),
  created_at timestamptz not null default now()
);

alter table public.fill_in_requests enable row level security;
alter table public.fill_in_requests force row level security;
alter table public.fill_in_responses enable row level security;
alter table public.fill_in_responses force row level security;
alter table public.fill_in_confirmations enable row level security;
alter table public.fill_in_confirmations force row level security;
revoke all on table public.fill_in_requests from public, anon, authenticated;
revoke all on table public.fill_in_responses from public, anon, authenticated;
revoke all on table public.fill_in_confirmations from public, anon, authenticated;
grant select, insert, update, delete on table public.fill_in_requests to service_role;
grant select, insert, update, delete on table public.fill_in_responses to service_role;
grant select, insert, update, delete on table public.fill_in_confirmations to service_role;

create or replace function public.player_is_fill_in_candidate(
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
    from public.players as player
    join public.teams as team
      on team.club_id = player.club_id
    where team.id = p_team_id
      and team.active
      and player.id = p_player_id
      and player.active
      and not exists (
        select 1
        from public.player_team_registrations as registration
        where registration.player_id = player.id
          and registration.team_id = team.id
          and registration.active
      )
  );
$$;

create or replace function public.assert_fill_in_manage(p_team_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id
    and team.active;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if public.caller_is_club_admin(team_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = team_row.id
        and membership.club_id = team_row.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role in ('HEAD_COACH', 'TEAM_MANAGER')
    )
  then
    return team_row;
  end if;

  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.masked_player_name(p_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.player_text(player.first_name)
    || ' '
    || substring(public.player_text(player.last_name) from 1 for 1)
    || '.'
  from public.players as player
  where player.id = p_player_id;
$$;

create or replace function public.list_fill_in_candidates(p_team_id uuid)
returns table (
  player_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_fill_in_manage(p_team_id);

  return query
  select
    player.id,
    public.masked_player_name(player.id)
  from public.players as player
  where public.player_is_fill_in_candidate(p_team_id, player.id)
  order by player.id;
end;
$$;

create or replace function public.request_fill_in(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  created_id uuid;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
    and event.status = 'SCHEDULED'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fill_in_manage(event_row.team_id);

  insert into public.fill_in_requests (club_id, team_id, event_id, requested_by)
  values (event_row.club_id, event_row.team_id, event_row.id, actor)
  returning id into created_id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fill_in.requested', created_id);

  return created_id;
end;
$$;

create or replace function public.respond_fill_in(
  p_request_id uuid,
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  created_id uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
  for update;

  if not found or request_row.status <> 'OPEN' then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.guardian_relationships as relationship
    join public.players as player
      on player.id = relationship.player_id
    where relationship.player_id = p_player_id
      and relationship.user_id = actor
      and relationship.club_id = request_row.club_id
      and relationship.active
      and player.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.player_is_fill_in_candidate(request_row.team_id, p_player_id) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.fill_in_responses (request_id, player_id, guardian_user_id)
  values (request_row.id, p_player_id, actor)
  on conflict (request_id, guardian_user_id, player_id) do nothing
  returning id into created_id;

  if created_id is not null then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (request_row.club_id, actor, 'fill_in.responded', created_id);
    return created_id;
  end if;

  select response.id
  into created_id
  from public.fill_in_responses as response
  where response.request_id = request_row.id
    and response.guardian_user_id = actor
    and response.player_id = p_player_id;

  return created_id;
end;
$$;

create or replace function public.confirm_fill_in(
  p_request_id uuid,
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  confirmation_id uuid;
  opponent text;
begin
  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.status <> 'OPEN' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  perform public.assert_fill_in_manage(request_row.team_id);

  if not public.player_is_fill_in_candidate(request_row.team_id, p_player_id) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.fill_in_responses as response
    where response.request_id = request_row.id
      and response.player_id = p_player_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select game.opponent_name
  into opponent
  from public.games as game
  where game.event_id = request_row.event_id;

  insert into public.fill_in_confirmations (request_id, player_id, confirmed_by)
  values (request_row.id, p_player_id, actor)
  returning id into confirmation_id;

  update public.fill_in_requests
  set status = 'CONFIRMED'
  where id = request_row.id
    and status = 'OPEN';

  if (select game.opponent_name from public.games as game where game.event_id = request_row.event_id)
    is distinct from opponent
  then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (request_row.club_id, actor, 'fill_in.confirmed', confirmation_id);

  return confirmation_id;
end;
$$;

create or replace function public.list_event_fill_in(p_event_id uuid)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
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

  if not (
    public.caller_is_club_admin(event_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = event_row.team_id
        and membership.club_id = event_row.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role in ('HEAD_COACH', 'TEAM_MANAGER')
    )
    or exists (
      select 1
      from public.guardian_relationships as relationship
      where relationship.user_id = actor
        and relationship.club_id = event_row.club_id
        and relationship.active
        and public.player_is_fill_in_candidate(
          event_row.team_id,
          relationship.player_id
        )
    )
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select request.id, request.status
  from public.fill_in_requests as request
  where request.event_id = event_row.id
    and request.status = 'OPEN'
  order by request.created_at
  limit 1;
end;
$$;

create or replace function public.list_fill_in_responses(p_request_id uuid)
returns table (
  player_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  request_row public.fill_in_requests;
begin
  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fill_in_manage(request_row.team_id);

  return query
  select
    response.player_id,
    public.masked_player_name(response.player_id)
  from public.fill_in_responses as response
  where response.request_id = request_row.id
  order by response.player_id;
end;
$$;

create or replace function public.list_guardian_fill_in_players(p_team_id uuid)
returns table (
  player_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id
    and team.active;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select
    player.id,
    public.masked_player_name(player.id)
  from public.guardian_relationships as relationship
  join public.players as player
    on player.id = relationship.player_id
  where relationship.user_id = actor
    and relationship.club_id = team_row.club_id
    and relationship.active
    and public.player_is_fill_in_candidate(team_row.id, player.id)
  order by player.id;
end;
$$;

drop function public.read_game_day(uuid);

create function public.read_game_day(p_event_id uuid)
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

revoke all on function public.player_is_fill_in_candidate(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.assert_fill_in_manage(uuid)
  from public, anon, authenticated;
revoke all on function public.masked_player_name(uuid)
  from public, anon, authenticated;
revoke all on function public.list_fill_in_candidates(uuid)
  from public, anon, authenticated;
revoke all on function public.request_fill_in(uuid)
  from public, anon, authenticated;
revoke all on function public.respond_fill_in(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_fill_in(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.list_event_fill_in(uuid)
  from public, anon, authenticated;
revoke all on function public.list_fill_in_responses(uuid)
  from public, anon, authenticated;
revoke all on function public.list_guardian_fill_in_players(uuid)
  from public, anon, authenticated;
revoke all on function public.read_game_day(uuid)
  from public, anon, authenticated;

grant execute on function public.list_fill_in_candidates(uuid) to authenticated;
grant execute on function public.request_fill_in(uuid) to authenticated;
grant execute on function public.respond_fill_in(uuid, uuid) to authenticated;
grant execute on function public.confirm_fill_in(uuid, uuid) to authenticated;
grant execute on function public.list_event_fill_in(uuid) to authenticated;
grant execute on function public.list_fill_in_responses(uuid) to authenticated;
grant execute on function public.list_guardian_fill_in_players(uuid) to authenticated;
grant execute on function public.read_game_day(uuid) to authenticated;

create or replace function public.enqueue_fill_in_requested(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
    and request.status = 'OPEN'
    and request.requested_by = actor;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.notification_requests (
    club_id, team_id, notification_type, source_id, recipient_user_id, payload
  )
  select distinct on (relationship.user_id)
    request_row.club_id,
    request_row.team_id,
    'FILL_IN_REQUESTED',
    request_row.id,
    relationship.user_id,
    jsonb_build_object(
      'notificationType', 'FILL_IN_REQUESTED',
      'teamId', request_row.team_id,
      'requestId', request_row.id
    )
  from public.guardian_relationships as relationship
  where relationship.club_id = request_row.club_id
    and relationship.active
    and public.player_is_fill_in_candidate(
      request_row.team_id,
      relationship.player_id
    )
  order by relationship.user_id
  on conflict (notification_type, source_id, recipient_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.enqueue_fill_in_confirmed(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  join public.fill_in_confirmations as confirmation
    on confirmation.request_id = request.id
  where request.id = p_request_id
    and request.status = 'CONFIRMED'
    and confirmation.confirmed_by = actor;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.notification_requests (
    club_id, team_id, notification_type, source_id, recipient_user_id, payload
  )
  select
    request_row.club_id,
    request_row.team_id,
    'FILL_IN_CONFIRMED',
    request_row.id,
    response.guardian_user_id,
    jsonb_build_object(
      'notificationType', 'FILL_IN_CONFIRMED',
      'teamId', request_row.team_id,
      'requestId', request_row.id
    )
  from public.fill_in_responses as response
  join public.fill_in_confirmations as confirmation
    on confirmation.request_id = response.request_id
    and confirmation.player_id = response.player_id
  where response.request_id = request_row.id
  on conflict (notification_type, source_id, recipient_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.apply_notification_provider_result(
  p_request_id uuid,
  p_token text,
  p_result text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  preference_enabled boolean;
  preference_found boolean := false;
  remaining_devices integer;
  event_key text;
  eligible boolean;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if request_row.status <> 'PENDING' then
    return request_row.status;
  end if;

  event_key := request_row.notification_type
    || ':' || request_row.source_id::text
    || ':' || request_row.recipient_user_id::text;

  if request_row.notification_type = 'ANNOUNCEMENT_PUBLISHED' then
    eligible := public.user_can_read_team_announcements(
      request_row.recipient_user_id,
      request_row.team_id
    );
  elsif request_row.notification_type = 'DUTY_SWAP_ACCEPTED' then
    eligible := public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      request_row.recipient_user_id
    );
  elsif request_row.notification_type = 'FILL_IN_REQUESTED' then
    eligible := exists (
      select 1
      from public.guardian_relationships as relationship
      where relationship.user_id = request_row.recipient_user_id
        and relationship.club_id = request_row.club_id
        and relationship.active
        and public.player_is_fill_in_candidate(
          request_row.team_id,
          relationship.player_id
        )
    );
  elsif request_row.notification_type = 'FILL_IN_CONFIRMED' then
    eligible := exists (
      select 1
      from public.fill_in_confirmations as confirmation
      join public.guardian_relationships as relationship
        on relationship.player_id = confirmation.player_id
        and relationship.club_id = request_row.club_id
      where confirmation.request_id = request_row.source_id
        and relationship.user_id = request_row.recipient_user_id
        and relationship.active
    );
  else
    eligible := true;
  end if;

  if not eligible then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'REVOKED'
    );
    return 'SKIPPED';
  end if;

  select preference.push_enabled
  into preference_enabled
  from public.notification_preferences as preference
  where preference.user_id = request_row.recipient_user_id
    and preference.category = request_row.notification_type;
  preference_found := found;

  if preference_found and not preference_enabled then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'PREFERENCE'
    );
    return 'SKIPPED';
  end if;

  if p_result = 'INVALID' then
    update public.device_endpoints
    set active = false
    where expo_push_token = p_token
      and user_id = request_row.recipient_user_id;

    select count(*)
    into remaining_devices
    from public.device_endpoints as endpoint
    where endpoint.user_id = request_row.recipient_user_id
      and endpoint.active;

    if remaining_devices > 0 then
      return 'PENDING';
    end if;

    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'INVALID'
    );
    return 'FAILED';
  end if;

  if p_result = 'OK' then
    update public.notification_requests
    set status = 'SENT'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, sent_at
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SENT',
      now()
    );
    return 'SENT';
  end if;

  if p_result = 'ERROR' then
    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'ERROR'
    );
    return 'FAILED';
  end if;

  raise exception 'VALIDATION_FAILED' using errcode = '23514';
end;
$$;

revoke all on function public.enqueue_fill_in_requested(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_fill_in_confirmed(uuid)
  from public, anon, authenticated;
revoke all on function public.apply_notification_provider_result(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.enqueue_fill_in_requested(uuid) to authenticated;
grant execute on function public.enqueue_fill_in_confirmed(uuid) to authenticated;
grant execute on function public.apply_notification_provider_result(uuid, text, text)
  to service_role;
