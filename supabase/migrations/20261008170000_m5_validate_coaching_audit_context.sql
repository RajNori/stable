-- Preserve opaque game context on player-stat audit records and validate all
-- caller-supplied team scopes against addressable source rows.
alter table public.audit_events
  add column context_event_id uuid references public.events (id);
alter table public.audit_events
  add constraint audit_events_context_event_for_stats_only check (
    context_event_id is null
    or action in ('game_player_stats.created', 'game_player_stats.corrected')
  );

drop trigger set_coaching_audit_team_before_write on public.audit_events;

create or replace function public.set_coaching_audit_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_team_id uuid;
  must_resolve_target boolean := false;
begin
  if new.action not in (
    'game.result_saved',
    'game_player_stats.created', 'game_player_stats.corrected',
    'post_game_review.created', 'post_game_review.completed',
    'post_game_review.updated', 'post_game_review.reopened',
    'recognition.created', 'recognition.updated', 'recognition.removed',
    'private_player_note.created', 'private_player_note.updated',
    'private_player_note.cleared',
    'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied',
    'practice_drill.created'
  ) then
    return new;
  end if;

  case new.action
    when 'game.result_saved' then
      must_resolve_target := true;
      select event.team_id into resolved_team_id
      from public.events as event
      where event.id = new.target_id and event.club_id = new.club_id;
    when 'game_player_stats.created', 'game_player_stats.corrected' then
      select event.team_id into resolved_team_id
      from public.events as event
      where event.id = new.context_event_id
        and event.club_id = new.club_id
        and event.event_type = 'GAME';
      if resolved_team_id is null then
        raise exception 'COACHING_AUDIT_EVENT_REQUIRED' using errcode = '23514';
      end if;
      if not exists (
        select 1
        from public.game_player_stats as stats
        where stats.game_event_id = new.context_event_id
          and stats.club_id = new.club_id
          and stats.team_id = resolved_team_id
          and stats.player_id = new.target_id
      ) then
        raise exception 'COACHING_AUDIT_TARGET_REQUIRED' using errcode = '23514';
      end if;
    when 'post_game_review.created', 'post_game_review.completed',
         'post_game_review.updated', 'post_game_review.reopened' then
      must_resolve_target := true;
      select review.team_id into resolved_team_id
      from public.post_game_reviews as review
      where review.id = new.target_id and review.club_id = new.club_id;
    when 'recognition.created', 'recognition.updated' then
      must_resolve_target := true;
      select recognition.team_id into resolved_team_id
      from public.player_game_recognitions as recognition
      where recognition.id = new.target_id and recognition.club_id = new.club_id;
    when 'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied' then
      must_resolve_target := true;
      select plan.team_id into resolved_team_id
      from public.practice_plans as plan
      where plan.id = new.target_id and plan.club_id = new.club_id;
    when 'practice_drill.created' then
      must_resolve_target := true;
      select drill.team_id into resolved_team_id
      from public.drills as drill
      where drill.id = new.target_id and drill.club_id = new.club_id;
    else
      null;
  end case;

  if must_resolve_target and resolved_team_id is null then
    raise exception 'COACHING_AUDIT_TARGET_REQUIRED' using errcode = '23514';
  end if;

  if resolved_team_id is not null then
    if new.team_id is not null and new.team_id <> resolved_team_id then
      raise exception 'COACHING_AUDIT_TEAM_MISMATCH' using errcode = '23514';
    end if;
    new.team_id := resolved_team_id;
  end if;

  if new.team_id is null then
    raise exception 'COACHING_AUDIT_TEAM_REQUIRED' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.teams as team
    where team.id = new.team_id and team.club_id = new.club_id
  ) then
    raise exception 'COACHING_AUDIT_TEAM_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger set_coaching_audit_team_before_write
  before insert or update of action, target_id, team_id, club_id, context_event_id
  on public.audit_events
  for each row
  execute function public.set_coaching_audit_team();

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
    insert into public.audit_events (
      club_id, team_id, context_event_id, actor_user_id, action, target_id
    ) values (
      event_row.club_id, event_row.team_id, event_row.id, actor,
      'game_player_stats.created', p_player_id
    );
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
    insert into public.audit_events (
      club_id, team_id, context_event_id, actor_user_id, action, target_id
    ) values (
      event_row.club_id, event_row.team_id, event_row.id, actor,
      'game_player_stats.corrected', p_player_id
    );
  end if;
end;
$$;
