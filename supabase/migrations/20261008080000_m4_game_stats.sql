-- M4 Slice 4.1. Stable-owned manual game results and player statistics.
-- All exposed reads/writes use scoped security-definer operations.

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'season.created', 'season.updated',
      'competition.created', 'competition.updated',
      'team.created', 'team.updated', 'venue.created', 'venue.updated',
      'player.created', 'player.imported', 'player.updated',
      'player.deactivated', 'player.reactivated',
      'guardian.linked', 'guardian.unlinked',
      'team_staff.assigned', 'team_staff.revoked', 'team_staff.reactivated',
      'player_team.registered', 'player_team.unregistered',
      'invitation.created', 'invitation.revoked', 'invitation.accepted',
      'fixture.created', 'fixture.imported', 'fixture.official_updated',
      'fixture.overlay_updated', 'duty.assigned', 'attendance.recorded',
      'training.created', 'training.series_created', 'training.updated',
      'training.checked_in', 'announcement.published',
      'announcement.updated', 'announcement.archived',
      'announcement.acknowledged', 'duty.acknowledged', 'duty.allocated',
      'duty.swap_requested', 'duty.swap_accepted', 'duty.swap_cancelled',
      'fill_in.requested', 'fill_in.responded', 'fill_in.confirmed',
      'game.result_saved', 'game_player_stats.created',
      'game_player_stats.corrected'
    )
  );

alter table public.events
  add constraint events_id_team_club_m4_key unique (id, team_id, club_id);

create table public.game_player_stats (
  game_event_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  player_id uuid not null,
  points integer not null default 0,
  rebounds integer not null default 0,
  assists integer not null default 0,
  steals integer not null default 0,
  fouls integer not null default 0,
  approximate_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_player_stats_pk primary key (game_event_id, player_id),
  constraint game_player_stats_game_team_club_fkey
    foreign key (game_event_id, team_id, club_id)
    references public.events (id, team_id, club_id),
  constraint game_player_stats_player_club_fkey
    foreign key (player_id, club_id) references public.players (id, club_id),
  constraint game_player_stats_points_check check (points between 0 and 100),
  constraint game_player_stats_rebounds_check check (rebounds between 0 and 100),
  constraint game_player_stats_assists_check check (assists between 0 and 100),
  constraint game_player_stats_steals_check check (steals between 0 and 100),
  constraint game_player_stats_fouls_check check (fouls between 0 and 20),
  constraint game_player_stats_minutes_check check (approximate_minutes between 0 and 120)
);

create table public.game_player_stat_revisions (
  id uuid primary key default gen_random_uuid(),
  game_event_id uuid not null,
  player_id uuid not null,
  actor_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  before_points integer not null,
  before_rebounds integer not null,
  before_assists integer not null,
  before_steals integer not null,
  before_fouls integer not null,
  before_approximate_minutes integer not null,
  after_points integer not null,
  after_rebounds integer not null,
  after_assists integer not null,
  after_steals integer not null,
  after_fouls integer not null,
  after_approximate_minutes integer not null,
  constraint game_player_stat_revisions_game_fkey
    foreign key (game_event_id, player_id)
    references public.game_player_stats (game_event_id, player_id),
  constraint game_player_stat_revisions_values_check check (
    before_points between 0 and 100 and after_points between 0 and 100
    and before_rebounds between 0 and 100 and after_rebounds between 0 and 100
    and before_assists between 0 and 100 and after_assists between 0 and 100
    and before_steals between 0 and 100 and after_steals between 0 and 100
    and before_fouls between 0 and 20 and after_fouls between 0 and 20
    and before_approximate_minutes between 0 and 120
    and after_approximate_minutes between 0 and 120
  )
);

create index game_player_stats_team_game_idx
  on public.game_player_stats (team_id, game_event_id);
create index game_player_stat_revisions_game_player_idx
  on public.game_player_stat_revisions (game_event_id, player_id, created_at);

create or replace function public.reject_game_player_stat_revision_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger game_player_stat_revisions_immutable
  before update or delete on public.game_player_stat_revisions
  for each row execute function public.reject_game_player_stat_revision_mutation();

create trigger game_player_stats_set_updated_at
  before update on public.game_player_stats
  for each row execute function public.set_updated_at();

alter table public.game_player_stats enable row level security;
alter table public.game_player_stats force row level security;
alter table public.game_player_stat_revisions enable row level security;
alter table public.game_player_stat_revisions force row level security;
revoke all on table public.game_player_stats from public, anon, authenticated;
revoke all on table public.game_player_stat_revisions from public, anon, authenticated;
grant select, insert, update, delete on table public.game_player_stats to service_role;
grant select, insert, update, delete on table public.game_player_stat_revisions to service_role;

create or replace function public.assert_coaching_stats_team(p_team_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select team.* into team_row
  from public.teams as team
  where team.id = p_team_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not team_row.active then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.caller_is_club_admin(team_row.club_id)
    and not exists (
      select 1 from public.team_memberships as membership
      where membership.team_id = team_row.id
        and membership.club_id = team_row.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return team_row;
end;
$$;

create or replace function public.read_game_coaching_stats(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  source text,
  team_score integer,
  opponent_score integer,
  result_status text,
  scheduled_minutes integer,
  player_id uuid,
  player_display_name text,
  active_registration boolean,
  points integer,
  rebounds integer,
  assists integer,
  steals integer,
  fouls integer,
  approximate_minutes integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
begin
  select event.* into event_row
  from public.events as event
  where event.id = p_event_id and event.event_type = 'GAME';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_coaching_stats_team(event_row.team_id);

  return query
  select
    event_row.id,
    event_row.club_id,
    event_row.team_id,
    game.source,
    game.team_score,
    game.opponent_score,
    game.result_status,
    case when event_row.ends_at is null then null
      else floor(extract(epoch from (event_row.ends_at - event_row.starts_at)) / 60)::integer
    end,
    player.id,
    concat_ws(' ', player.first_name, player.last_name),
    coalesce(registration.active and player.active, false),
    stats.points,
    stats.rebounds,
    stats.assists,
    stats.steals,
    stats.fouls,
    stats.approximate_minutes
  from public.games as game
  left join public.players as player on player.club_id = event_row.club_id
  left join public.player_team_registrations as registration
    on registration.player_id = player.id
    and registration.club_id = event_row.club_id
    and registration.team_id = event_row.team_id
  left join public.game_player_stats as stats
    on stats.game_event_id = event_row.id
    and stats.player_id = player.id
  where game.event_id = event_row.id
    and (registration.active is true or stats.player_id is not null)
  order by player.last_name, player.first_name, player.id;
end;
$$;

create or replace function public.save_manual_game_result(
  p_event_id uuid,
  p_team_score integer,
  p_opponent_score integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  game_row public.games;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_team_score is null or p_opponent_score is null
    or p_team_score not between 0 and 250
    or p_opponent_score not between 0 and 250 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select event.* into event_row
  from public.events as event
  where event.id = p_event_id and event.event_type = 'GAME'
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_coaching_stats_team(event_row.team_id);

  select game.* into game_row
  from public.games as game
  where game.event_id = event_row.id
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if game_row.source <> 'MANUAL' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if game_row.team_score is distinct from p_team_score
    or game_row.opponent_score is distinct from p_opponent_score
    or game_row.result_status is distinct from 'FINAL' then
    update public.games
    set team_score = p_team_score,
        opponent_score = p_opponent_score,
        result_status = 'FINAL'
    where event_id = event_row.id;
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (event_row.club_id, actor, 'game.result_saved', event_row.id);
  end if;
end;
$$;

create or replace function public.save_game_player_stat(
  p_event_id uuid,
  p_player_id uuid,
  p_points integer,
  p_rebounds integer,
  p_assists integer,
  p_steals integer,
  p_fouls integer,
  p_approximate_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  old_row public.game_player_stats;
  scheduled_minutes integer;
  creating boolean;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_points not between 0 and 100
    or p_rebounds not between 0 and 100
    or p_assists not between 0 and 100
    or p_steals not between 0 and 100
    or p_fouls not between 0 and 20
    or p_approximate_minutes not between 0 and 120 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select event.* into event_row
  from public.events as event
  where event.id = p_event_id and event.event_type = 'GAME'
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_coaching_stats_team(event_row.team_id);
  if not exists (select 1 from public.games where event_id = event_row.id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  scheduled_minutes := case when event_row.ends_at is null then 120
    else floor(extract(epoch from (event_row.ends_at - event_row.starts_at)) / 60)::integer
  end;
  if p_approximate_minutes > scheduled_minutes then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_player_id::text, 0));
  select stats.* into old_row
  from public.game_player_stats as stats
  where stats.game_event_id = p_event_id and stats.player_id = p_player_id
  for update;
  creating := not found;

  if creating and not exists (
    select 1
    from public.players as player
    join public.player_team_registrations as registration
      on registration.player_id = player.id
      and registration.club_id = player.club_id
      and registration.team_id = event_row.team_id
      and registration.active
    where player.id = p_player_id
      and player.club_id = event_row.club_id
      and player.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if creating then
    insert into public.game_player_stats (
      game_event_id, club_id, team_id, player_id,
      points, rebounds, assists, steals, fouls, approximate_minutes
    ) values (
      event_row.id, event_row.club_id, event_row.team_id, p_player_id,
      p_points, p_rebounds, p_assists, p_steals, p_fouls, p_approximate_minutes
    );
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (event_row.club_id, actor, 'game_player_stats.created', p_player_id);
  elsif old_row.points is distinct from p_points
    or old_row.rebounds is distinct from p_rebounds
    or old_row.assists is distinct from p_assists
    or old_row.steals is distinct from p_steals
    or old_row.fouls is distinct from p_fouls
    or old_row.approximate_minutes is distinct from p_approximate_minutes then
    update public.game_player_stats
    set points = p_points, rebounds = p_rebounds, assists = p_assists,
        steals = p_steals, fouls = p_fouls,
        approximate_minutes = p_approximate_minutes
    where game_event_id = p_event_id and player_id = p_player_id;
    insert into public.game_player_stat_revisions (
      game_event_id, player_id, actor_user_id,
      before_points, before_rebounds, before_assists, before_steals,
      before_fouls, before_approximate_minutes,
      after_points, after_rebounds, after_assists, after_steals,
      after_fouls, after_approximate_minutes
    ) values (
      p_event_id, p_player_id, actor,
      old_row.points, old_row.rebounds, old_row.assists, old_row.steals,
      old_row.fouls, old_row.approximate_minutes,
      p_points, p_rebounds, p_assists, p_steals, p_fouls, p_approximate_minutes
    );
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (event_row.club_id, actor, 'game_player_stats.corrected', p_player_id);
  end if;
end;
$$;

-- The legacy fixture RPC remains for fixture metadata, but it must never
-- overwrite scores or accept imported/provider-owned rows.
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
  game_row public.games;
  v_court text;
  v_round text;
  v_opponent text;
  v_venue text;
  v_official_court text;
  next_event_status text;
begin
  select event.* into event_row
  from public.events as event
  where event.id = p_event_id and event.event_type = 'GAME'
  for update;
  if not found or event_row.club_id <> p_club_id or event_row.team_id <> p_team_id then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_fixture_team(event_row.team_id, 'manual');

  select game.* into game_row
  from public.games as game where game.event_id = event_row.id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if game_row.source <> 'MANUAL' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select normalized.court_label, normalized.round_label,
         normalized.opponent_name, normalized.official_venue_text,
         normalized.official_court_label
  into v_court, v_round, v_opponent, v_venue, v_official_court
  from public.normalize_official_fixture(
    p_club_id, p_starts_at, p_ends_at, p_venue_id, p_court_label,
    p_competition_id, p_round_label, p_opponent_name, p_official_start_at,
    p_official_venue_text, p_official_court_label, p_home_away,
    p_fixture_status, null, null, null
  ) as normalized;

  next_event_status := case p_fixture_status
    when 'CANCELLED' then 'CANCELLED'
    when 'COMPLETED' then 'COMPLETED'
    else 'SCHEDULED'
  end;
  update public.events
  set starts_at = p_starts_at, ends_at = p_ends_at, venue_id = p_venue_id,
      court_label = v_court, status = next_event_status
  where id = event_row.id;
  update public.games
  set competition_id = p_competition_id, round_label = v_round,
      opponent_name = v_opponent, official_start_at = p_official_start_at,
      official_venue_text = v_venue, official_court_label = v_official_court,
      fixture_status = p_fixture_status, home_away = p_home_away
  where event_id = event_row.id;
  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fixture.official_updated', event_row.id);
end;
$$;

revoke all on function public.assert_coaching_stats_team(uuid) from public, anon, authenticated;
revoke all on function public.reject_game_player_stat_revision_mutation() from public, anon, authenticated;
revoke all on function public.read_game_coaching_stats(uuid) from public, anon;
revoke all on function public.save_manual_game_result(uuid, integer, integer) from public, anon;
revoke all on function public.save_game_player_stat(uuid, uuid, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.read_game_coaching_stats(uuid) to authenticated, service_role;
grant execute on function public.save_manual_game_result(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.save_game_player_stat(uuid, uuid, integer, integer, integer, integer, integer, integer) to authenticated, service_role;
