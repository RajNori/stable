-- M4 Slice 4.1: minutes follow the scheduled duration when it is known.
alter table public.game_player_stats
  drop constraint game_player_stats_minutes_check;
alter table public.game_player_stats
  add constraint game_player_stats_minutes_check check (approximate_minutes >= 0);

alter table public.game_player_stat_revisions
  drop constraint game_player_stat_revisions_values_check;
alter table public.game_player_stat_revisions
  add constraint game_player_stat_revisions_values_check check (
    before_points between 0 and 100 and after_points between 0 and 100
    and before_rebounds between 0 and 100 and after_rebounds between 0 and 100
    and before_assists between 0 and 100 and after_assists between 0 and 100
    and before_steals between 0 and 100 and after_steals between 0 and 100
    and before_fouls between 0 and 20 and after_fouls between 0 and 20
    and before_approximate_minutes >= 0
    and after_approximate_minutes >= 0
  );

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
    or p_approximate_minutes is null
    or p_approximate_minutes < 0 then
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
