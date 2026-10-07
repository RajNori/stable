-- Forward upgrade for databases that already applied the earlier
-- 20261007220000_fill_in_one_confirmation.sql, which dropped
-- fill_in_requests_one_open. Supabase does not rerun that file.
--
-- Duplicate OPEN requests are not withdrawn, deleted, or chosen. An operator
-- must reconcile those rows before this migration can apply. A clean history
-- restores at most one OPEN request per event beside the existing at most one
-- confirmed fill-in per event.
--
-- FILL_IN_REQUESTED delivery eligibility stays in
-- 20261007250000_fill_in_request_lifecycle.sql. This migration does not
-- replace that function.

create or replace function public.restore_fill_in_open_request_invariant()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflict_count integer;
  conflict_detail text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_confirmations_one_event'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_requests_one_confirmed'
  ) then
    raise exception
      'FILL_IN_CONFIRMATION_INVARIANT_MISSING: the one-confirmation indexes are absent. Restore at most one confirmed fill-in per event before this upgrade. No fill-in or audit row was changed.'
      using errcode = '23514';
  end if;

  select count(*)::integer,
    string_agg(
      conflict.event_id::text || ' (' || conflict.open_count::text || ')',
      ', ' order by conflict.event_id::text
    )
  into conflict_count, conflict_detail
  from (
    select request.event_id, count(*)::integer as open_count
    from public.fill_in_requests as request
    where request.status = 'OPEN'
    group by request.event_id
    having count(*) > 1
  ) as conflict;

  if conflict_count > 0 then
    raise exception
      'FILL_IN_OPEN_REQUEST_HISTORY_CONFLICT: % event(s) already have more than one open fill-in request [%]. Reconcile those open request rows before this migration. No request or audit row was changed.',
      conflict_count,
      conflict_detail
      using errcode = '23514';
  end if;

  create unique index if not exists fill_in_requests_one_open
    on public.fill_in_requests (event_id)
    where status = 'OPEN';
end;
$$;

revoke all on function public.restore_fill_in_open_request_invariant()
  from public, anon, authenticated;

select public.restore_fill_in_open_request_invariant();

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
  for update;

  if not found
    or event_row.event_type <> 'GAME'
    or event_row.status <> 'SCHEDULED'
    or not exists (
      select 1
      from public.games as game
      where game.event_id = event_row.id
    )
  then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Active team and head coach, team manager, or club admin.
  perform public.assert_fill_in_manage(event_row.team_id);

  if exists (
    select 1
    from public.fill_in_requests as request
    where request.event_id = event_row.id
      and request.status in ('OPEN', 'CONFIRMED')
  ) or exists (
    select 1
    from public.fill_in_confirmations as confirmation
    where confirmation.event_id = event_row.id
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  begin
    insert into public.fill_in_requests (club_id, team_id, event_id, requested_by)
    values (event_row.club_id, event_row.team_id, event_row.id, actor)
    returning id into created_id;
  exception
    when unique_violation then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fill_in.requested', created_id);

  return created_id;
end;
$$;

revoke all on function public.request_fill_in(uuid)
  from public, anon, authenticated;
grant execute on function public.request_fill_in(uuid) to authenticated;
