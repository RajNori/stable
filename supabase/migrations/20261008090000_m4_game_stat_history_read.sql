-- M4 Slice 4.1 follow-up: expose restricted correction history to staff
-- authorized for coaching_stats.read, without names or direct table grants.
create or replace function public.read_game_player_stat_history(p_event_id uuid)
returns table (
  event_id uuid,
  player_id uuid,
  actor_user_id uuid,
  occurred_at timestamptz,
  before_points integer,
  before_rebounds integer,
  before_assists integer,
  before_steals integer,
  before_fouls integer,
  before_approximate_minutes integer,
  after_points integer,
  after_rebounds integer,
  after_assists integer,
  after_steals integer,
  after_fouls integer,
  after_approximate_minutes integer
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

  -- The shared M4 capability matrix grants Club Admin, Head Coach and
  -- Assistant Coach access. This helper rejects managers, guardians, revoked
  -- memberships, and callers outside the game team's active tenant scope.
  perform public.assert_coaching_stats_team(event_row.team_id);

  return query
  select
    revision.game_event_id,
    revision.player_id,
    revision.actor_user_id,
    revision.created_at,
    revision.before_points,
    revision.before_rebounds,
    revision.before_assists,
    revision.before_steals,
    revision.before_fouls,
    revision.before_approximate_minutes,
    revision.after_points,
    revision.after_rebounds,
    revision.after_assists,
    revision.after_steals,
    revision.after_fouls,
    revision.after_approximate_minutes
  from public.game_player_stat_revisions as revision
  where revision.game_event_id = event_row.id
  order by revision.created_at, revision.id;
end;
$$;

revoke all on function public.read_game_player_stat_history(uuid) from public, anon;
grant execute on function public.read_game_player_stat_history(uuid) to authenticated;
