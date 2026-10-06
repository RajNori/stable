-- Slice 2.5 training. One events calendar, a bounded weekly series, and one coach check-in.

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
      'training.checked_in'
    )
  );

create table public.recurrence_series (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  weekday smallint not null,
  local_time time not null,
  timezone text not null,
  starts_on date not null,
  ends_on date,
  court_label text,
  lead_coach_user_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint recurrence_series_team_same_club foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint recurrence_series_id_team unique (id, team_id),
  constraint recurrence_series_weekday_check check (weekday between 1 and 7),
  constraint recurrence_series_window_check check (
    ends_on is null or ends_on >= starts_on
  )
);

alter table public.events
  add column recurrence_series_id uuid,
  add constraint events_recurrence_series_same_team
    foreign key (recurrence_series_id, team_id)
    references public.recurrence_series (id, team_id);

create table public.training_sessions (
  event_id uuid primary key references public.events (id),
  lead_coach_user_id uuid references auth.users (id),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id),
  constraint training_sessions_checkin_pair check (
    (checked_in_at is null) = (checked_in_by is null)
  )
);

alter table public.recurrence_series enable row level security;
alter table public.training_sessions enable row level security;
alter table public.recurrence_series force row level security;
alter table public.training_sessions force row level security;
revoke all on table public.recurrence_series from public, anon, authenticated;
revoke all on table public.training_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.recurrence_series to service_role;
grant select, insert, update, delete on table public.training_sessions to service_role;

create or replace function public.assert_training_manage(p_team_id uuid)
returns void
language plpgsql
stable
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
    return;
  end if;

  if exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'TEAM_MANAGER')
  ) then
    return;
  end if;

  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.assert_training_coach(p_team_id uuid)
returns void
language plpgsql
stable
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

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id;

  if not found or not team_row.active then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_lead_coach(
  p_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.team_memberships as membership
    join public.teams as team on team.id = membership.team_id
    where membership.team_id = p_team_id
      and membership.user_id = p_user_id
      and membership.active
      and team.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.assert_training_timezone(p_timezone text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_timezone is null or btrim(p_timezone) = '' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  perform timezone(p_timezone, now());
exception
  when invalid_parameter_value then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
end;
$$;

create or replace function public.insert_training_event(
  p_club_id uuid,
  p_team_id uuid,
  p_series_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_court_label text,
  p_lead_coach_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  insert into public.events (
    club_id,
    team_id,
    event_type,
    starts_at,
    ends_at,
    court_label,
    status,
    recurrence_series_id
  )
  values (
    p_club_id,
    p_team_id,
    'TRAINING',
    p_starts_at,
    p_ends_at,
    p_court_label,
    'SCHEDULED',
    p_series_id
  )
  returning id into created_id;

  insert into public.training_sessions (event_id, lead_coach_user_id)
  values (created_id, p_lead_coach_user_id);

  return created_id;
end;
$$;

create or replace function public.create_training_session(
  p_club_id uuid,
  p_team_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_court_label text,
  p_lead_coach_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_id uuid;
  court text;
begin
  if p_club_id is null or p_team_id is null or p_starts_at is null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform public.assert_training_manage(p_team_id);
  if not exists (
    select 1
    from public.teams as team
    where team.id = p_team_id
      and team.club_id = p_club_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_lead_coach(p_team_id, p_lead_coach_user_id);
  court := public.fixture_text(p_court_label, 80, false);
  created_id := public.insert_training_event(
    p_club_id,
    p_team_id,
    null,
    p_starts_at,
    p_ends_at,
    court,
    p_lead_coach_user_id
  );

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'training.created', created_id);
  return created_id;
end;
$$;

create or replace function public.materialize_training_series(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  series_row public.recurrence_series;
  horizon date;
  occurrence_date date;
  starts_at timestamptz;
  created_count integer := 0;
begin
  select series.*
  into series_row
  from public.recurrence_series as series
  where series.id = p_series_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  horizon := least(
    coalesce(series_row.ends_on, series_row.starts_on + 105),
    series_row.starts_on + 105
  );

  for occurrence_date in
    select day::date
    from generate_series(series_row.starts_on, horizon, interval '1 day') as day
    where extract(isodow from day)::integer = series_row.weekday
  loop
    starts_at := (occurrence_date + series_row.local_time) at time zone series_row.timezone;
    perform public.insert_training_event(
      series_row.club_id,
      series_row.team_id,
      series_row.id,
      starts_at,
      starts_at + interval '90 minutes',
      series_row.court_label,
      series_row.lead_coach_user_id
    );
    created_count := created_count + 1;
  end loop;

  if created_count = 0 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  return created_count;
end;
$$;

create or replace function public.create_training_series(
  p_club_id uuid,
  p_team_id uuid,
  p_weekday smallint,
  p_local_time time,
  p_timezone text,
  p_starts_on date,
  p_ends_on date,
  p_court_label text,
  p_lead_coach_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  series_id uuid;
  horizon date;
begin
  if p_weekday is null or p_weekday < 1 or p_weekday > 7 or p_local_time is null or p_starts_on is null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  if extract(isodow from p_starts_on)::integer <> p_weekday then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform public.assert_training_timezone(p_timezone);
  perform public.assert_training_manage(p_team_id);
  if not exists (
    select 1
    from public.teams as team
    where team.id = p_team_id
      and team.club_id = p_club_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_lead_coach(p_team_id, p_lead_coach_user_id);
  horizon := least(coalesce(p_ends_on, p_starts_on + 105), p_starts_on + 105);

  insert into public.recurrence_series (
    club_id, team_id, weekday, local_time, timezone, starts_on, ends_on,
    court_label, lead_coach_user_id
  )
  values (
    p_club_id,
    p_team_id,
    p_weekday,
    p_local_time,
    p_timezone,
    p_starts_on,
    horizon,
    public.fixture_text(p_court_label, 80, false),
    p_lead_coach_user_id
  )
  returning id into series_id;

  perform public.materialize_training_series(series_id);

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'training.series_created', series_id);
  return series_id;
end;
$$;

create or replace function public.reschedule_attached_training(
  p_series_id uuid,
  p_from timestamptz,
  p_weekday smallint,
  p_local_time time,
  p_timezone text,
  p_ends_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  series_row public.recurrence_series;
  event_row record;
  local_date date;
  shifted date;
  next_start timestamptz;
begin
  select series.*
  into series_row
  from public.recurrence_series as series
  where series.id = p_series_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  for event_row in
    select event.id, event.starts_at
    from public.events as event
    where event.recurrence_series_id = p_series_id
      and event.starts_at >= p_from
    order by event.starts_at
    for update
  loop
    local_date := (event_row.starts_at at time zone series_row.timezone)::date;
    shifted := local_date + (p_weekday - series_row.weekday);
    next_start := (shifted + p_local_time) at time zone p_timezone;
    update public.events
    set
      starts_at = next_start,
      ends_at = next_start + interval '90 minutes',
      status = case
        when p_ends_on is not null and shifted > p_ends_on then 'CANCELLED'
        else status
      end
    where id = event_row.id;
  end loop;

  update public.recurrence_series
  set
    weekday = p_weekday,
    local_time = p_local_time,
    timezone = p_timezone,
    ends_on = p_ends_on
  where id = p_series_id;
end;
$$;

create or replace function public.edit_training_occurrence(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_court_label text,
  p_lead_coach_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'TRAINING'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if event_row.recurrence_series_id is not null then
    perform 1
    from public.recurrence_series as series
    where series.id = event_row.recurrence_series_id
    for update;
  end if;

  perform public.assert_training_manage(event_row.team_id);
  perform public.assert_lead_coach(event_row.team_id, p_lead_coach_user_id);
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  update public.events
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    court_label = public.fixture_text(p_court_label, 80, false),
    recurrence_series_id = null
  where id = event_row.id;

  update public.training_sessions
  set lead_coach_user_id = p_lead_coach_user_id
  where event_id = event_row.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'training.updated', event_row.id);
  return event_row.id;
end;
$$;

create or replace function public.edit_training_following(
  p_event_id uuid,
  p_weekday smallint,
  p_local_time time,
  p_timezone text,
  p_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  series_row public.recurrence_series;
  occurrence_date date;
  new_series_id uuid;
begin
  if p_weekday is null or p_weekday < 1 or p_weekday > 7 or p_local_time is null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  perform public.assert_training_timezone(p_timezone);

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'TRAINING'
  for update;

  if not found or event_row.recurrence_series_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select series.*
  into series_row
  from public.recurrence_series as series
  where series.id = event_row.recurrence_series_id
  for update;

  perform public.assert_training_manage(event_row.team_id);
  occurrence_date := (event_row.starts_at at time zone series_row.timezone)::date;
  if p_ends_on is not null and p_ends_on < occurrence_date then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  update public.recurrence_series
  set ends_on = occurrence_date - 1
  where id = series_row.id;

  insert into public.recurrence_series (
    club_id, team_id, weekday, local_time, timezone, starts_on, ends_on,
    court_label, lead_coach_user_id
  )
  values (
    series_row.club_id,
    series_row.team_id,
    series_row.weekday,
    series_row.local_time,
    series_row.timezone,
    occurrence_date,
    coalesce(p_ends_on, series_row.ends_on),
    series_row.court_label,
    series_row.lead_coach_user_id
  )
  returning id into new_series_id;

  update public.events
  set recurrence_series_id = new_series_id
  where recurrence_series_id = series_row.id
    and starts_at >= event_row.starts_at;

  perform public.reschedule_attached_training(
    new_series_id,
    event_row.starts_at,
    p_weekday,
    p_local_time,
    p_timezone,
    coalesce(p_ends_on, series_row.ends_on)
  );

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'training.updated', new_series_id);
  return new_series_id;
end;
$$;

create or replace function public.edit_training_series(
  p_series_id uuid,
  p_weekday smallint,
  p_local_time time,
  p_timezone text,
  p_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  series_row public.recurrence_series;
begin
  if p_weekday is null or p_weekday < 1 or p_weekday > 7 or p_local_time is null then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  perform public.assert_training_timezone(p_timezone);

  select series.*
  into series_row
  from public.recurrence_series as series
  where series.id = p_series_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_ends_on is not null and p_ends_on < series_row.starts_on then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform public.assert_training_manage(series_row.team_id);
  perform public.reschedule_attached_training(
    p_series_id,
    now(),
    p_weekday,
    p_local_time,
    p_timezone,
    p_ends_on
  );

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (series_row.club_id, actor, 'training.updated', p_series_id);
  return p_series_id;
end;
$$;

create or replace function public.check_in_training(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  session_row public.training_sessions;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'TRAINING'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_training_coach(event_row.team_id);

  select session.*
  into session_row
  from public.training_sessions as session
  where session.event_id = event_row.id
  for update;

  if session_row.checked_in_at is not null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  update public.training_sessions
  set checked_in_at = now(), checked_in_by = actor
  where event_id = event_row.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'training.checked_in', event_row.id);
end;
$$;

revoke all on function public.assert_training_manage(uuid) from public, anon, authenticated;
revoke all on function public.assert_training_coach(uuid) from public, anon, authenticated;
revoke all on function public.assert_lead_coach(uuid, uuid) from public, anon, authenticated;
revoke all on function public.assert_training_timezone(text) from public, anon, authenticated;
revoke all on function public.insert_training_event(uuid, uuid, uuid, timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
revoke all on function public.materialize_training_series(uuid) from public, anon, authenticated;
revoke all on function public.reschedule_attached_training(uuid, timestamptz, smallint, time, text, date)
  from public, anon, authenticated;
revoke all on function public.create_training_session(uuid, uuid, timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_training_series(uuid, uuid, smallint, time, text, date, date, text, uuid)
  from public, anon, authenticated;
revoke all on function public.edit_training_occurrence(uuid, timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
revoke all on function public.edit_training_following(uuid, smallint, time, text, date)
  from public, anon, authenticated;
revoke all on function public.edit_training_series(uuid, smallint, time, text, date)
  from public, anon, authenticated;
revoke all on function public.check_in_training(uuid) from public, anon, authenticated;

grant execute on function public.create_training_session(uuid, uuid, timestamptz, timestamptz, text, uuid)
  to authenticated;
grant execute on function public.create_training_series(uuid, uuid, smallint, time, text, date, date, text, uuid)
  to authenticated;
grant execute on function public.edit_training_occurrence(uuid, timestamptz, timestamptz, text, uuid)
  to authenticated;
grant execute on function public.edit_training_following(uuid, smallint, time, text, date)
  to authenticated;
grant execute on function public.edit_training_series(uuid, smallint, time, text, date)
  to authenticated;
grant execute on function public.check_in_training(uuid) to authenticated;
