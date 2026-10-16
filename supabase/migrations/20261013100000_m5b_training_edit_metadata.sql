-- Return the minimum recurrence/coach metadata needed by the authorized
-- training manager UI. The backing tables remain inaccessible to callers.
create or replace function public.list_team_training_edit_metadata(
  p_team_id uuid,
  p_event_ids uuid[]
)
returns table (
  event_id uuid,
  recurrence_series_id uuid,
  weekday smallint,
  local_time time,
  timezone text,
  ends_on date,
  lead_coach_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_team_id is null or p_event_ids is null or cardinality(p_event_ids) > 100
    or array_position(p_event_ids, null) is not null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform public.assert_training_manage(p_team_id);

  if (
    select count(distinct requested.event_id)
    from unnest(p_event_ids) as requested(event_id)
    join public.events as event
      on event.id = requested.event_id
      and event.team_id = p_team_id
      and event.event_type = 'TRAINING'
  ) <> cardinality(p_event_ids) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select
    event.id,
    event.recurrence_series_id,
    series.weekday,
    series.local_time,
    series.timezone,
    series.ends_on,
    training.lead_coach_user_id
  from unnest(p_event_ids) as requested(event_id)
  join public.events as event
    on event.id = requested.event_id
    and event.team_id = p_team_id
    and event.event_type = 'TRAINING'
  left join public.recurrence_series as series
    on series.id = event.recurrence_series_id
  left join public.training_sessions as training
    on training.event_id = event.id
  order by event.starts_at, event.id;
end;
$$;

revoke all on function public.list_team_training_edit_metadata(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.list_team_training_edit_metadata(uuid, uuid[])
  to authenticated;
