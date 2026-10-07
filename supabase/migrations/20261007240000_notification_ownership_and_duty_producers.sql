-- Device tokens stay with their active owner. Duty mutations enqueue their notices.

create or replace function public.register_device_endpoint(
  p_token text,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  endpoint_id uuid;
  normalized text;
  existing public.device_endpoints;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_platform not in ('IOS', 'ANDROID', 'WEB') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  normalized := public.fixture_text(p_token, 200, true);

  select endpoint.*
  into existing
  from public.device_endpoints as endpoint
  where endpoint.expo_push_token = normalized
  for update;

  if found then
    if existing.user_id <> actor and existing.active then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    update public.device_endpoints
    set user_id = actor,
        platform = p_platform,
        active = true,
        last_seen_at = now()
    where id = existing.id
    returning id into endpoint_id;

    return endpoint_id;
  end if;

  begin
    insert into public.device_endpoints (user_id, platform, expo_push_token)
    values (actor, p_platform, normalized)
    returning id into endpoint_id;
    return endpoint_id;
  exception
    when unique_violation then
      select endpoint.*
      into existing
      from public.device_endpoints as endpoint
      where endpoint.expo_push_token = normalized
      for update;

      if existing.user_id <> actor and existing.active then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;

      update public.device_endpoints
      set user_id = actor,
          platform = p_platform,
          active = true,
          last_seen_at = now()
      where id = existing.id
      returning id into endpoint_id;

      return endpoint_id;
  end;
end;
$$;

create or replace function public.enqueue_duty_notification(
  p_club_id uuid,
  p_team_id uuid,
  p_notification_type text,
  p_source_id uuid,
  p_recipient_user_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_notification_type not in ('DUTY_ASSIGNED', 'DUTY_SWAP_REQUESTED') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.notification_requests (
    club_id,
    team_id,
    notification_type,
    source_id,
    recipient_user_id,
    payload
  )
  values (
    p_club_id,
    p_team_id,
    p_notification_type,
    p_source_id,
    p_recipient_user_id,
    p_payload
  )
  on conflict (notification_type, source_id, recipient_user_id) do nothing;
end;
$$;

revoke all on function public.enqueue_duty_notification(uuid, uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.assign_game_duty(
  p_event_id uuid,
  p_duty_type text,
  p_label text,
  p_assigned_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  normalized text;
  created_id uuid;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');

  if p_duty_type not in ('SCORER', 'CLOCK', 'CANTEEN', 'OTHER') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  normalized := public.fixture_text(p_label, 80, true);

  if not public.caller_can_take_duty(
    event_row.club_id,
    event_row.team_id,
    p_assigned_user_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.duties (club_id, team_id, event_id, duty_type, label)
  values (event_row.club_id, event_row.team_id, event_row.id, p_duty_type, normalized)
  returning id into created_id;

  insert into public.duty_assignments (duty_id, assigned_user_id, status, assigned_by)
  values (created_id, p_assigned_user_id, 'ASSIGNED', actor);

  perform public.enqueue_duty_notification(
    event_row.club_id,
    event_row.team_id,
    'DUTY_ASSIGNED',
    created_id,
    p_assigned_user_id,
    jsonb_build_object(
      'notificationType', 'DUTY_ASSIGNED',
      'teamId', event_row.team_id,
      'dutyId', created_id
    )
  );

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'duty.assigned', created_id);

  return created_id;
end;
$$;

create or replace function public.commit_duty_allocation(
  p_event_id uuid,
  p_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  current_fingerprint text;
  piece text;
  duty_id uuid;
  assigned_user uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');
  current_fingerprint := public.duty_allocation_fingerprint(p_event_id);
  if current_fingerprint is distinct from p_fingerprint then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  foreach piece in array string_to_array(p_fingerprint, '|')
  loop
    duty_id := split_part(piece, ':', 1)::uuid;
    assigned_user := split_part(piece, ':', 2)::uuid;
    if not public.caller_can_take_duty(
      event_row.club_id,
      event_row.team_id,
      assigned_user
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;

    insert into public.duty_assignments (
      duty_id, assigned_user_id, status, assigned_by
    )
    values (duty_id, assigned_user, 'ASSIGNED', actor);

    perform public.enqueue_duty_notification(
      event_row.club_id,
      event_row.team_id,
      'DUTY_ASSIGNED',
      duty_id,
      assigned_user,
      jsonb_build_object(
        'notificationType', 'DUTY_ASSIGNED',
        'teamId', event_row.team_id,
        'dutyId', duty_id
      )
    );
  end loop;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'duty.allocated', event_row.id);
end;
$$;

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

  -- An open swap has no named recipient in the notification contract, so
  -- DUTY_SWAP_REQUESTED is produced only for a targeted request.
  if p_target_user_id is not null then
    perform public.enqueue_duty_notification(
      event_row.club_id,
      event_row.team_id,
      'DUTY_SWAP_REQUESTED',
      created_id,
      p_target_user_id,
      jsonb_build_object(
        'notificationType', 'DUTY_SWAP_REQUESTED',
        'teamId', event_row.team_id,
        'requestId', created_id
      )
    );
  end if;

  return created_id;
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

revoke all on function public.apply_notification_provider_result(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_notification_provider_result(uuid, text, text)
  to service_role;
