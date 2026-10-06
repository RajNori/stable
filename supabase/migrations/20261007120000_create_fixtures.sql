-- Slice 2.1 official fixtures and team overlay.
-- Classification: additive. No backfill and no destructive change.
-- Manual and imported fixtures share one official write path.
-- There is no PlayHQ client and no sync run. Mapping rows are local only.
-- Overlay writes cannot change opponent, round, official start, venue, court,
-- fixture status, or scores.
-- Authenticated clients have no table privileges. They call the functions below.

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
      'fixture.overlay_updated'
    )
  );

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  event_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_id uuid,
  court_label text,
  status text not null default 'SCHEDULED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_id_club_key unique (id, club_id),
  constraint events_team_same_club foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint events_venue_same_club foreign key (venue_id, club_id)
    references public.venues (id, club_id),
  constraint events_type_check check (event_type in ('GAME', 'TRAINING')),
  constraint events_status_check check (
    status in ('SCHEDULED', 'CANCELLED', 'COMPLETED')
  ),
  constraint events_time_check check (ends_at is null or ends_at > starts_at),
  constraint events_court_label_check check (
    court_label is null
    or (
      char_length(court_label) between 1 and 80
      and court_label = btrim(court_label)
      and court_label !~ '[[:cntrl:]]'
    )
  )
);

create table public.games (
  event_id uuid primary key references public.events (id),
  club_id uuid not null,
  competition_id uuid,
  round_label text,
  opponent_name text not null,
  source text not null,
  external_id text,
  official_start_at timestamptz not null,
  official_venue_text text,
  official_court_label text,
  fixture_status text not null,
  home_away text,
  team_score integer,
  opponent_score integer,
  result_status text,
  last_external_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_event_same_club foreign key (event_id, club_id)
    references public.events (id, club_id),
  constraint games_competition_same_club foreign key (competition_id, club_id)
    references public.competitions (id, club_id),
  constraint games_source_check check (source in ('MANUAL', 'IMPORT')),
  constraint games_source_identity_check check (
    (
      source = 'MANUAL'
      and external_id is null
      and last_external_sync_at is null
    )
    or (source = 'IMPORT' and external_id is not null)
  ),
  constraint games_fixture_status_check check (
    fixture_status in ('SCHEDULED', 'POSTPONED', 'CANCELLED', 'COMPLETED')
  ),
  constraint games_home_away_check check (
    home_away is null or home_away in ('HOME', 'AWAY', 'NEUTRAL')
  ),
  constraint games_team_score_check check (
    team_score is null or team_score between 0 and 999
  ),
  constraint games_opponent_score_check check (
    opponent_score is null or opponent_score between 0 and 999
  ),
  constraint games_result_status_check check (
    result_status is null or result_status = 'FINAL'
  ),
  constraint games_opponent_name_check check (
    char_length(opponent_name) between 1 and 120
    and opponent_name = btrim(opponent_name)
    and opponent_name !~ '[[:cntrl:]]'
  ),
  constraint games_round_label_check check (
    round_label is null
    or (
      char_length(round_label) between 1 and 40
      and round_label = btrim(round_label)
      and round_label !~ '[[:cntrl:]]'
    )
  ),
  constraint games_official_venue_text_check check (
    official_venue_text is null
    or (
      char_length(official_venue_text) between 1 and 200
      and official_venue_text = btrim(official_venue_text)
      and official_venue_text !~ '[[:cntrl:]]'
    )
  ),
  constraint games_official_court_label_check check (
    official_court_label is null
    or (
      char_length(official_court_label) between 1 and 80
      and official_court_label = btrim(official_court_label)
      and official_court_label !~ '[[:cntrl:]]'
    )
  ),
  constraint games_external_id_check check (
    external_id is null
    or (
      char_length(external_id) between 1 and 120
      and external_id = btrim(external_id)
      and external_id !~ '[[:cntrl:]]'
    )
  )
);

create table public.game_team_overlay (
  game_event_id uuid primary key references public.games (event_id),
  arrival_at timestamptz,
  uniform_note text,
  coach_focus text,
  team_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_team_overlay_uniform_note_check check (
    uniform_note is null
    or (
      char_length(uniform_note) between 1 and 500
      and uniform_note = btrim(uniform_note)
      and uniform_note !~ '[[:cntrl:]]'
    )
  ),
  constraint game_team_overlay_coach_focus_check check (
    coach_focus is null
    or (
      char_length(coach_focus) between 1 and 500
      and coach_focus = btrim(coach_focus)
      and coach_focus !~ '[[:cntrl:]]'
    )
  ),
  constraint game_team_overlay_team_note_check check (
    team_note is null
    or (
      char_length(team_note) between 1 and 500
      and team_note = btrim(team_note)
      and team_note !~ '[[:cntrl:]]'
    )
  )
);

create table public.playhq_mappings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  internal_type text not null,
  internal_id uuid not null,
  external_id text not null,
  external_parent_id text,
  created_at timestamptz not null default now(),
  constraint playhq_mappings_internal_type_check check (internal_type = 'game'),
  constraint playhq_mappings_external_id_check check (
    char_length(external_id) between 1 and 120
    and external_id = btrim(external_id)
    and external_id !~ '[[:cntrl:]]'
  ),
  constraint playhq_mappings_external_parent_check check (
    external_parent_id is null
    or (
      char_length(external_parent_id) between 1 and 120
      and external_parent_id = btrim(external_parent_id)
      and external_parent_id !~ '[[:cntrl:]]'
    )
  ),
  constraint playhq_mappings_internal_key unique (club_id, internal_type, internal_id),
  constraint playhq_mappings_external_key unique (club_id, internal_type, external_id)
);

create index events_team_starts_at_idx
  on public.events (team_id, starts_at, id);
create index events_club_id_idx on public.events (club_id);
create index games_club_id_idx on public.games (club_id);

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

create trigger games_set_updated_at
  before update on public.games
  for each row
  execute function public.set_updated_at();

create trigger game_team_overlay_set_updated_at
  before update on public.game_team_overlay
  for each row
  execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.games enable row level security;
alter table public.game_team_overlay enable row level security;
alter table public.playhq_mappings enable row level security;
alter table public.events force row level security;
alter table public.games force row level security;
alter table public.game_team_overlay force row level security;
alter table public.playhq_mappings force row level security;

revoke all on table public.events from public, anon, authenticated;
revoke all on table public.games from public, anon, authenticated;
revoke all on table public.game_team_overlay from public, anon, authenticated;
revoke all on table public.playhq_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.events to service_role;
grant select, insert, update, delete on table public.games to service_role;
grant select, insert, update, delete on table public.game_team_overlay to service_role;
grant select, insert, update, delete on table public.playhq_mappings to service_role;

create or replace function public.fixture_text(
  p_value text,
  p_max integer,
  p_required boolean
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  if p_value is null then
    normalized := null;
  else
    normalized := btrim(p_value);
  end if;

  if normalized is null or normalized = '' then
    if p_required then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
    return null;
  end if;

  if char_length(normalized) > p_max or normalized ~ '[[:cntrl:]]' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  return normalized;
end;
$$;

create or replace function public.assert_fixture_team(
  p_team_id uuid,
  p_mode text
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
  allowed boolean := false;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if p_mode not in ('read', 'manual', 'overlay') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not team_row.active then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if public.caller_is_club_admin(team_row.club_id) then
    allowed := true;
  elsif p_mode = 'read' and exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER')
  ) then
    allowed := true;
  elsif p_mode = 'read' and exists (
    select 1
    from public.guardian_relationships as relationship
    join public.player_team_registrations as registration
      on registration.player_id = relationship.player_id
      and registration.club_id = relationship.club_id
    join public.players as player
      on player.id = relationship.player_id
      and player.club_id = relationship.club_id
    where relationship.user_id = actor
      and relationship.active
      and registration.active
      and registration.team_id = team_row.id
      and player.active
  ) then
    allowed := true;
  elsif p_mode = 'manual' and exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role = 'TEAM_MANAGER'
  ) then
    allowed := true;
  elsif p_mode = 'overlay' and exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'TEAM_MANAGER')
  ) then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return team_row;
end;
$$;

create or replace function public.normalize_official_fixture(
  p_club_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_id uuid,
  p_court_label text,
  p_competition_id uuid,
  p_round_label text,
  p_opponent_name text,
  p_official_start_at timestamptz,
  p_official_venue_text text,
  p_official_court_label text,
  p_home_away text,
  p_fixture_status text,
  p_team_score integer,
  p_opponent_score integer,
  p_result_status text
)
returns table (
  court_label text,
  round_label text,
  opponent_name text,
  official_venue_text text,
  official_court_label text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_starts_at is null or p_official_start_at is null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_fixture_status not in ('SCHEDULED', 'POSTPONED', 'CANCELLED', 'COMPLETED') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_home_away is not null and p_home_away not in ('HOME', 'AWAY', 'NEUTRAL') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_result_status is not null and p_result_status <> 'FINAL' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_team_score is not null and (p_team_score < 0 or p_team_score > 999) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_opponent_score is not null and (p_opponent_score < 0 or p_opponent_score > 999) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_venue_id is not null and not exists (
    select 1
    from public.venues as venue
    where venue.id = p_venue_id
      and venue.club_id = p_club_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_competition_id is not null and not exists (
    select 1
    from public.competitions as competition
    where competition.id = p_competition_id
      and competition.club_id = p_club_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  return query
  select
    public.fixture_text(p_court_label, 80, false),
    public.fixture_text(p_round_label, 40, false),
    public.fixture_text(p_opponent_name, 120, true),
    public.fixture_text(p_official_venue_text, 200, false),
    public.fixture_text(p_official_court_label, 80, false);
end;
$$;

create or replace function public.fixture_projection(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_id uuid,
  court_label text,
  event_status text,
  competition_id uuid,
  round_label text,
  opponent_name text,
  source text,
  external_id text,
  official_start_at timestamptz,
  official_venue_text text,
  official_court_label text,
  fixture_status text,
  home_away text,
  team_score integer,
  opponent_score integer,
  result_status text,
  last_external_sync_at timestamptz,
  arrival_at timestamptz,
  uniform_note text,
  coach_focus text,
  team_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    event.club_id,
    event.team_id,
    event.starts_at,
    event.ends_at,
    event.venue_id,
    event.court_label,
    event.status,
    game.competition_id,
    game.round_label,
    game.opponent_name,
    game.source,
    game.external_id,
    game.official_start_at,
    game.official_venue_text,
    game.official_court_label,
    game.fixture_status,
    game.home_away,
    game.team_score,
    game.opponent_score,
    game.result_status,
    game.last_external_sync_at,
    overlay.arrival_at,
    overlay.uniform_note,
    overlay.coach_focus,
    overlay.team_note
  from public.events as event
  join public.games as game on game.event_id = event.id
  join public.game_team_overlay as overlay
    on overlay.game_event_id = game.event_id
  where event.id = p_event_id
    and event.event_type = 'GAME';
$$;

create or replace function public.insert_official_fixture(
  p_club_id uuid,
  p_team_id uuid,
  p_source text,
  p_external_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_id uuid,
  p_court_label text,
  p_competition_id uuid,
  p_round_label text,
  p_opponent_name text,
  p_official_start_at timestamptz,
  p_official_venue_text text,
  p_official_court_label text,
  p_home_away text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
  v_court text;
  v_round text;
  v_opponent text;
  v_venue text;
  v_official_court text;
  v_external text;
  created_id uuid;
begin
  team_row := public.assert_fixture_team(p_team_id, 'manual');

  if team_row.club_id <> p_club_id then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_source not in ('MANUAL', 'IMPORT') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  v_external := public.fixture_text(p_external_id, 120, p_source = 'IMPORT');
  if p_source = 'MANUAL' and v_external is not null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_source = 'IMPORT' and exists (
    select 1
    from public.playhq_mappings as mapping
    where mapping.club_id = p_club_id
      and mapping.internal_type = 'game'
      and mapping.external_id = v_external
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  select
    normalized.court_label,
    normalized.round_label,
    normalized.opponent_name,
    normalized.official_venue_text,
    normalized.official_court_label
  into v_court, v_round, v_opponent, v_venue, v_official_court
  from public.normalize_official_fixture(
    p_club_id,
    p_starts_at,
    p_ends_at,
    p_venue_id,
    p_court_label,
    p_competition_id,
    p_round_label,
    p_opponent_name,
    p_official_start_at,
    p_official_venue_text,
    p_official_court_label,
    p_home_away,
    'SCHEDULED',
    null,
    null,
    null
  ) as normalized;

  insert into public.events (
    club_id,
    team_id,
    event_type,
    starts_at,
    ends_at,
    venue_id,
    court_label,
    status
  )
  values (
    p_club_id,
    p_team_id,
    'GAME',
    p_starts_at,
    p_ends_at,
    p_venue_id,
    v_court,
    'SCHEDULED'
  )
  returning id into created_id;

  insert into public.games (
    event_id,
    club_id,
    competition_id,
    round_label,
    opponent_name,
    source,
    external_id,
    official_start_at,
    official_venue_text,
    official_court_label,
    fixture_status,
    home_away,
    team_score,
    opponent_score,
    result_status,
    last_external_sync_at
  )
  values (
    created_id,
    p_club_id,
    p_competition_id,
    v_round,
    v_opponent,
    p_source,
    case when p_source = 'IMPORT' then v_external else null end,
    p_official_start_at,
    v_venue,
    v_official_court,
    'SCHEDULED',
    p_home_away,
    null,
    null,
    null,
    case when p_source = 'IMPORT' then now() else null end
  );

  insert into public.game_team_overlay (game_event_id)
  values (created_id);

  if p_source = 'IMPORT' then
    insert into public.playhq_mappings (
      club_id,
      internal_type,
      internal_id,
      external_id
    )
    values (p_club_id, 'game', created_id, v_external);
  end if;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (
    p_club_id,
    actor,
    case when p_source = 'IMPORT' then 'fixture.imported' else 'fixture.created' end,
    created_id
  );

  return created_id;
exception
  when unique_violation then
    raise exception 'CONFLICT' using errcode = 'P0001';
end;
$$;

create or replace function public.create_manual_fixture(
  p_club_id uuid,
  p_team_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_id uuid,
  p_court_label text,
  p_competition_id uuid,
  p_round_label text,
  p_opponent_name text,
  p_official_start_at timestamptz,
  p_official_venue_text text,
  p_official_court_label text,
  p_home_away text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.insert_official_fixture(
    p_club_id,
    p_team_id,
    'MANUAL',
    null,
    p_starts_at,
    p_ends_at,
    p_venue_id,
    p_court_label,
    p_competition_id,
    p_round_label,
    p_opponent_name,
    p_official_start_at,
    p_official_venue_text,
    p_official_court_label,
    p_home_away
  );
end;
$$;

create or replace function public.import_fixture(
  p_club_id uuid,
  p_team_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_id uuid,
  p_court_label text,
  p_competition_id uuid,
  p_round_label text,
  p_opponent_name text,
  p_official_start_at timestamptz,
  p_official_venue_text text,
  p_official_court_label text,
  p_home_away text,
  p_external_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.insert_official_fixture(
    p_club_id,
    p_team_id,
    'IMPORT',
    p_external_id,
    p_starts_at,
    p_ends_at,
    p_venue_id,
    p_court_label,
    p_competition_id,
    p_round_label,
    p_opponent_name,
    p_official_start_at,
    p_official_venue_text,
    p_official_court_label,
    p_home_away
  );
end;
$$;

create or replace function public.update_official_fixture(
  p_club_id uuid,
  p_team_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_id uuid,
  p_court_label text,
  p_competition_id uuid,
  p_round_label text,
  p_opponent_name text,
  p_official_start_at timestamptz,
  p_official_venue_text text,
  p_official_court_label text,
  p_home_away text,
  p_event_id uuid,
  p_fixture_status text,
  p_team_score integer,
  p_opponent_score integer,
  p_result_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  v_court text;
  v_round text;
  v_opponent text;
  v_venue text;
  v_official_court text;
  next_event_status text;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found or event_row.club_id <> p_club_id or event_row.team_id <> p_team_id then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');

  select
    normalized.court_label,
    normalized.round_label,
    normalized.opponent_name,
    normalized.official_venue_text,
    normalized.official_court_label
  into v_court, v_round, v_opponent, v_venue, v_official_court
  from public.normalize_official_fixture(
    p_club_id,
    p_starts_at,
    p_ends_at,
    p_venue_id,
    p_court_label,
    p_competition_id,
    p_round_label,
    p_opponent_name,
    p_official_start_at,
    p_official_venue_text,
    p_official_court_label,
    p_home_away,
    p_fixture_status,
    p_team_score,
    p_opponent_score,
    p_result_status
  ) as normalized;

  next_event_status := case p_fixture_status
    when 'CANCELLED' then 'CANCELLED'
    when 'COMPLETED' then 'COMPLETED'
    else 'SCHEDULED'
  end;

  update public.events
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    venue_id = p_venue_id,
    court_label = v_court,
    status = next_event_status
  where id = event_row.id;

  update public.games
  set
    competition_id = p_competition_id,
    round_label = v_round,
    opponent_name = v_opponent,
    official_start_at = p_official_start_at,
    official_venue_text = v_venue,
    official_court_label = v_official_court,
    fixture_status = p_fixture_status,
    home_away = p_home_away,
    team_score = p_team_score,
    opponent_score = p_opponent_score,
    result_status = p_result_status
  where event_id = event_row.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fixture.official_updated', event_row.id);
end;
$$;

create or replace function public.update_fixture_overlay(
  p_event_id uuid,
  p_arrival_at timestamptz,
  p_uniform_note text,
  p_coach_focus text,
  p_team_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  v_uniform text;
  v_focus text;
  v_note text;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'overlay');
  v_uniform := public.fixture_text(p_uniform_note, 500, false);
  v_focus := public.fixture_text(p_coach_focus, 500, false);
  v_note := public.fixture_text(p_team_note, 500, false);

  update public.game_team_overlay
  set
    arrival_at = p_arrival_at,
    uniform_note = v_uniform,
    coach_focus = v_focus,
    team_note = v_note
  where game_event_id = event_row.id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fixture.overlay_updated', event_row.id);
end;
$$;

create or replace function public.read_fixture(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_id uuid,
  court_label text,
  event_status text,
  competition_id uuid,
  round_label text,
  opponent_name text,
  source text,
  external_id text,
  official_start_at timestamptz,
  official_venue_text text,
  official_court_label text,
  fixture_status text,
  home_away text,
  team_score integer,
  opponent_score integer,
  result_status text,
  last_external_sync_at timestamptz,
  arrival_at timestamptz,
  uniform_note text,
  coach_focus text,
  team_note text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
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

  perform public.assert_fixture_team(event_row.team_id, 'read');

  return query
  select projection.*
  from public.fixture_projection(p_event_id) as projection;
end;
$$;

create or replace function public.list_team_fixtures(p_team_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_id uuid,
  court_label text,
  event_status text,
  competition_id uuid,
  round_label text,
  opponent_name text,
  source text,
  external_id text,
  official_start_at timestamptz,
  official_venue_text text,
  official_court_label text,
  fixture_status text,
  home_away text,
  team_score integer,
  opponent_score integer,
  result_status text,
  last_external_sync_at timestamptz,
  arrival_at timestamptz,
  uniform_note text,
  coach_focus text,
  team_note text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_fixture_team(p_team_id, 'read');

  return query
  select projection.*
  from public.events as event
  join lateral public.fixture_projection(event.id) as projection on true
  where event.team_id = p_team_id
    and event.event_type = 'GAME'
  order by event.starts_at, event.id;
end;
$$;

revoke all on function public.fixture_text(text, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.assert_fixture_team(uuid, text)
  from public, anon, authenticated;
revoke all on function public.normalize_official_fixture(
  uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text, text, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.fixture_projection(uuid)
  from public, anon, authenticated;
revoke all on function public.insert_official_fixture(
  uuid, uuid, text, text, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text
) from public, anon, authenticated;
revoke all on function public.create_manual_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text
) from public, anon, authenticated;
revoke all on function public.import_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.update_official_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text, uuid, text, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.update_fixture_overlay(uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
revoke all on function public.read_fixture(uuid) from public, anon, authenticated;
revoke all on function public.list_team_fixtures(uuid) from public, anon, authenticated;

grant execute on function public.create_manual_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text
) to authenticated;
grant execute on function public.import_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text, text
) to authenticated;
grant execute on function public.update_official_fixture(
  uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, timestamptz, text, text, text, uuid, text, integer, integer, text
) to authenticated;
grant execute on function public.update_fixture_overlay(uuid, timestamptz, text, text, text)
  to authenticated;
grant execute on function public.read_fixture(uuid) to authenticated;
grant execute on function public.list_team_fixtures(uuid) to authenticated;
