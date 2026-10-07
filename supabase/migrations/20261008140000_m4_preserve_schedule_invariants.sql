-- Keep roster eligibility and scheduled-duration rules true under concurrent
-- registration changes and later edits to event schedules.

create or replace function public.enforce_game_stat_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_row public.players;
begin
  -- Registration commands lock the player before changing registrations.
  -- Taking the same lock makes eligibility and insertion one serialized fact.
  select player.* into player_row
  from public.players as player
  where player.id = new.player_id
    and player.club_id = new.club_id
  for update;

  if not found or not player_row.active or not exists (
    select 1 from public.player_team_registrations as registration
    where registration.player_id = new.player_id
      and registration.club_id = new.club_id
      and registration.team_id = new.team_id
      and registration.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_game_stat_registration() from public, anon, authenticated;
create trigger game_player_stats_require_current_registration
before insert on public.game_player_stats
for each row execute function public.enforce_game_stat_registration();

create or replace function public.preserve_scheduled_duration_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_minutes numeric;
  saved_minutes numeric;
  plan_minutes numeric;
begin
  if new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;

  if new.event_type = 'GAME' then
    scheduled_minutes := case when new.ends_at is null then 120
      else floor(extract(epoch from (new.ends_at - new.starts_at)) / 60)::numeric
    end;
    select max(stats.approximate_minutes) into saved_minutes
    from public.game_player_stats as stats
    where stats.game_event_id = new.id;
    if saved_minutes is not null and saved_minutes > scheduled_minutes then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
  elsif new.event_type = 'TRAINING' then
    scheduled_minutes := case when new.ends_at is null then 240
      else floor(extract(epoch from (new.ends_at - new.starts_at)) / 60)::numeric
    end;
    select sum(block.duration_minutes) into plan_minutes
    from public.practice_plans as plan
    join public.practice_blocks as block on block.practice_plan_id = plan.id
    where plan.training_event_id = new.id;
    if plan_minutes is not null and plan_minutes > scheduled_minutes then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.preserve_scheduled_duration_invariants() from public, anon, authenticated;
create trigger events_preserve_scheduled_duration_invariants
before update of starts_at, ends_at on public.events
for each row execute function public.preserve_scheduled_duration_invariants();
