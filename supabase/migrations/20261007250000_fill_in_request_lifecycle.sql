-- A fill-in request notice is not deliverable after the event is confirmed.

create or replace function public.enqueue_fill_in_requested(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
    and request.status = 'OPEN'
    and request.requested_by = actor;

  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.fill_in_confirmations as confirmation
    where confirmation.event_id = request_row.event_id
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.notification_requests (
    club_id, team_id, notification_type, source_id, recipient_user_id, payload
  )
  select distinct on (relationship.user_id)
    request_row.club_id,
    request_row.team_id,
    'FILL_IN_REQUESTED',
    request_row.id,
    relationship.user_id,
    jsonb_build_object(
      'notificationType', 'FILL_IN_REQUESTED',
      'teamId', request_row.team_id,
      'requestId', request_row.id
    )
  from public.guardian_relationships as relationship
  where relationship.club_id = request_row.club_id
    and relationship.active
    and public.player_is_fill_in_candidate(
      request_row.team_id,
      relationship.player_id
    )
  order by relationship.user_id
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
  elsif request_row.notification_type in (
    'DUTY_SWAP_ACCEPTED',
    'DUTY_ASSIGNED',
    'DUTY_SWAP_REQUESTED'
  ) then
    eligible := public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      request_row.recipient_user_id
    );
  elsif request_row.notification_type = 'FILL_IN_REQUESTED' then
    eligible := exists (
      select 1
      from public.fill_in_requests as source_request
      where source_request.id = request_row.source_id
        and source_request.status = 'OPEN'
        and not exists (
          select 1
          from public.fill_in_confirmations as confirmation
          where confirmation.event_id = source_request.event_id
        )
    )
    and exists (
      select 1
      from public.guardian_relationships as relationship
      where relationship.user_id = request_row.recipient_user_id
        and relationship.club_id = request_row.club_id
        and relationship.active
        and public.player_is_fill_in_candidate(
          request_row.team_id,
          relationship.player_id
        )
    );
  elsif request_row.notification_type = 'FILL_IN_CONFIRMED' then
    eligible := exists (
      select 1
      from public.fill_in_confirmations as confirmation
      join public.guardian_relationships as relationship
        on relationship.player_id = confirmation.player_id
        and relationship.club_id = request_row.club_id
      where confirmation.request_id = request_row.source_id
        and relationship.user_id = request_row.recipient_user_id
        and relationship.active
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

revoke all on function public.enqueue_fill_in_requested(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_fill_in_requested(uuid)
  to authenticated;

revoke all on function public.apply_notification_provider_result(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_notification_provider_result(uuid, text, text)
  to service_role;
