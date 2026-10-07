-- Slice 3.4 duty swaps. One open request, one winning acceptance.

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
      'training.checked_in',
      'announcement.published',
      'announcement.updated',
      'announcement.archived',
      'announcement.acknowledged',
      'duty.acknowledged',
      'duty.allocated',
      'duty.swap_requested',
      'duty.swap_accepted',
      'duty.swap_cancelled'
    )
  );

create table public.duty_swap_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  team_id uuid not null,
  assignment_id uuid not null references public.duty_assignments (id),
  requester_user_id uuid not null references public.profiles (user_id),
  target_user_id uuid references public.profiles (user_id),
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint duty_swap_requests_team_club_fkey
    foreign key (team_id, club_id) references public.teams (id, club_id),
  constraint duty_swap_requests_status_check check (
    status in ('OPEN', 'ACCEPTED', 'CANCELLED', 'EXPIRED')
  ),
  constraint duty_swap_requests_target_check check (
    target_user_id is null or target_user_id <> requester_user_id
  )
);

create unique index duty_swap_requests_one_open
  on public.duty_swap_requests (assignment_id)
  where status = 'OPEN';

alter table public.duty_swap_requests enable row level security;
alter table public.duty_swap_requests force row level security;
revoke all on table public.duty_swap_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.duty_swap_requests to service_role;

create or replace function public.request_duty_swap(
  p_event_id uuid,
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  assignment_row public.duty_assignments;
  created_id uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
    and event.status = 'SCHEDULED'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select assignment.*
  into assignment_row
  from public.duty_assignments as assignment
  join public.duties as duty
    on duty.id = assignment.duty_id
  where duty.event_id = event_row.id
    and assignment.assigned_user_id = actor
  for update;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_target_user_id is not null
    and not public.caller_can_take_duty(
      event_row.club_id,
      event_row.team_id,
      p_target_user_id
    )
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.duty_swap_requests (
    club_id, team_id, assignment_id, requester_user_id, target_user_id
  )
  values (
    event_row.club_id,
    event_row.team_id,
    assignment_row.id,
    actor,
    p_target_user_id
  )
  returning id into created_id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'duty.swap_requested', created_id);

  return created_id;
end;
$$;

create or replace function public.cancel_duty_swap(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.duty_swap_requests;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.duty_swap_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.requester_user_id <> actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if request_row.status <> 'OPEN' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  update public.duty_swap_requests
  set status = 'CANCELLED',
      resolved_at = now()
  where id = request_row.id
    and status = 'OPEN';

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (request_row.club_id, actor, 'duty.swap_cancelled', request_row.id);
end;
$$;

create or replace function public.accept_duty_swap(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.duty_swap_requests;
  assignment_row public.duty_assignments;
  event_row public.events;
  updated_id uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.duty_swap_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select assignment.*
  into assignment_row
  from public.duty_assignments as assignment
  where assignment.id = request_row.assignment_id
  for update;

  select event.*
  into event_row
  from public.events as event
  join public.duties as duty
    on duty.event_id = event.id
  where duty.id = assignment_row.duty_id
  for update;

  if request_row.status <> 'OPEN'
    or assignment_row.assigned_user_id <> request_row.requester_user_id
    or event_row.event_type <> 'GAME'
    or event_row.status <> 'SCHEDULED'
  then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if request_row.target_user_id is not null
    and request_row.target_user_id <> actor
  then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if actor = request_row.requester_user_id
    or not public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      actor
    )
  then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.duty_assignments
  set assigned_user_id = actor,
      acknowledged_at = null
  where id = assignment_row.id
    and assigned_user_id = request_row.requester_user_id;

  update public.duty_swap_requests
  set status = 'ACCEPTED',
      resolved_at = now()
  where id = request_row.id
    and status = 'OPEN'
  returning id into updated_id;

  if updated_id is null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (request_row.club_id, actor, 'duty.swap_accepted', request_row.id);

  return request_row.id;
end;
$$;

create or replace function public.enqueue_duty_swap_accepted(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.duty_swap_requests;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.duty_swap_requests as request
  join public.duty_assignments as assignment
    on assignment.id = request.assignment_id
  where request.id = p_request_id
    and request.status = 'ACCEPTED'
    and assignment.assigned_user_id = actor;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.notification_requests (
    club_id, team_id, notification_type, source_id, recipient_user_id, payload
  )
  values (
    request_row.club_id,
    request_row.team_id,
    'DUTY_SWAP_ACCEPTED',
    request_row.id,
    request_row.requester_user_id,
    jsonb_build_object(
      'notificationType', 'DUTY_SWAP_ACCEPTED',
      'teamId', request_row.team_id,
      'requestId', request_row.id
    )
  )
  on conflict (notification_type, source_id, recipient_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.apply_notification_provider_result(
  p_request_id uuid,
  p_token text,
  p_result text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  preference_enabled boolean;
  preference_found boolean := false;
  remaining_devices integer;
  event_key text;
  eligible boolean;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if request_row.status <> 'PENDING' then
    return request_row.status;
  end if;

  event_key := request_row.notification_type
    || ':' || request_row.source_id::text
    || ':' || request_row.recipient_user_id::text;

  if request_row.notification_type = 'ANNOUNCEMENT_PUBLISHED' then
    eligible := public.user_can_read_team_announcements(
      request_row.recipient_user_id,
      request_row.team_id
    );
  elsif request_row.notification_type = 'DUTY_SWAP_ACCEPTED' then
    eligible := public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      request_row.recipient_user_id
    );
  else
    eligible := true;
  end if;

  if not eligible then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'REVOKED'
    );
    return 'SKIPPED';
  end if;

  select preference.push_enabled
  into preference_enabled
  from public.notification_preferences as preference
  where preference.user_id = request_row.recipient_user_id
    and preference.category = request_row.notification_type;
  preference_found := found;

  if preference_found and not preference_enabled then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'PREFERENCE'
    );
    return 'SKIPPED';
  end if;

  if p_result = 'INVALID' then
    update public.device_endpoints
    set active = false
    where expo_push_token = p_token
      and user_id = request_row.recipient_user_id;

    select count(*)
    into remaining_devices
    from public.device_endpoints as endpoint
    where endpoint.user_id = request_row.recipient_user_id
      and endpoint.active;

    if remaining_devices > 0 then
      return 'PENDING';
    end if;

    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'INVALID'
    );
    return 'FAILED';
  end if;

  if p_result = 'OK' then
    update public.notification_requests
    set status = 'SENT'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, sent_at
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SENT',
      now()
    );
    return 'SENT';
  end if;

  if p_result = 'ERROR' then
    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'ERROR'
    );
    return 'FAILED';
  end if;

  raise exception 'VALIDATION_FAILED' using errcode = '23514';
end;
$$;

create or replace function public.list_open_duty_swaps(p_event_id uuid)
returns table (
  id uuid,
  label text,
  requester_user_id uuid,
  target_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
  event_row public.events;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.caller_can_take_duty(event_row.club_id, event_row.team_id, actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select request.id, duty.label, request.requester_user_id, request.target_user_id
  from public.duty_swap_requests as request
  join public.duty_assignments as assignment
    on assignment.id = request.assignment_id
  join public.duties as duty
    on duty.id = assignment.duty_id
  where duty.event_id = event_row.id
    and request.status = 'OPEN'
    and (
      request.target_user_id is null
      or request.target_user_id = actor
      or request.requester_user_id = actor
    )
  order by request.created_at;
end;
$$;

revoke all on function public.request_duty_swap(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_open_duty_swaps(uuid) from public, anon, authenticated;
revoke all on function public.cancel_duty_swap(uuid) from public, anon, authenticated;
revoke all on function public.accept_duty_swap(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_duty_swap_accepted(uuid) from public, anon, authenticated;
revoke all on function public.apply_notification_provider_result(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.request_duty_swap(uuid, uuid) to authenticated;
grant execute on function public.list_open_duty_swaps(uuid) to authenticated;
grant execute on function public.cancel_duty_swap(uuid) to authenticated;
grant execute on function public.accept_duty_swap(uuid) to authenticated;
grant execute on function public.enqueue_duty_swap_accepted(uuid) to authenticated;
grant execute on function public.apply_notification_provider_result(uuid, text, text)
  to service_role;
