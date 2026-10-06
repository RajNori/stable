-- Slice 2.2 one chronological team agenda.
-- Games and training are rows in events. There is no second calendar.

create or replace function public.list_team_schedule(
  p_team_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_event_type text
)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  court_label text,
  event_status text,
  opponent_name text,
  round_label text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_range_start is null or p_range_end is null or p_range_end < p_range_start then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_event_type is not null and p_event_type not in ('GAME', 'TRAINING') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform public.assert_fixture_team(p_team_id, 'read');

  return query
  select
    event.id,
    event.club_id,
    event.team_id,
    event.event_type,
    event.starts_at,
    event.ends_at,
    event.court_label,
    event.status,
    game.opponent_name,
    game.round_label
  from public.events as event
  left join public.games as game on game.event_id = event.id
  where event.team_id = p_team_id
    and event.starts_at >= p_range_start
    and event.starts_at <= p_range_end
    and (p_event_type is null or event.event_type = p_event_type)
  order by event.starts_at, event.id;
end;
$$;

revoke all on function public.list_team_schedule(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.list_team_schedule(uuid, timestamptz, timestamptz, text)
  to authenticated;
