-- Trusted, single-claim Expo dispatch with send-time authorization and receipts.

alter table public.notification_requests
  add column dispatch_claim_id uuid,
  add column dispatch_claimed_at timestamptz,
  add column dispatch_started_at timestamptz,
  add column dispatch_endpoint_id uuid references public.device_endpoints (id);

create unique index notification_requests_dispatch_claim_id_key
  on public.notification_requests (dispatch_claim_id)
  where dispatch_claim_id is not null;

create table public.notification_provider_receipts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique
    references public.notification_deliveries (id),
  endpoint_id uuid not null references public.device_endpoints (id),
  provider_receipt_id text not null unique,
  status text not null default 'PENDING',
  error_code text,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  constraint notification_provider_receipts_status_check
    check (status in ('PENDING', 'OK', 'ERROR')),
  constraint notification_provider_receipts_error_check
    check (
      error_code is null
      or error_code in (
        'DeviceNotRegistered',
        'MessageTooBig',
        'MessageRateExceeded',
        'MismatchSenderId',
        'InvalidCredentials',
        'ProviderError'
      )
    )
);

alter table public.notification_provider_receipts enable row level security;
alter table public.notification_provider_receipts force row level security;
revoke all on table public.notification_provider_receipts
  from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_provider_receipts
  to service_role;

create or replace function public.notification_request_is_current(
  p_request_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id;

  if not found then
    return false;
  end if;

  if request_row.notification_type in (
    'ANNOUNCEMENT_PUBLISHED',
    'FIXTURE_CHANGED',
    'GAME_REMINDER',
    'RSVP_REQUIRED',
    'TRAINING_CHANGED',
    'TRAINING_CANCELLED'
  ) then
    return public.user_can_read_team_announcements(
      request_row.recipient_user_id,
      request_row.team_id
    );
  end if;

  if request_row.notification_type in (
    'DUTY_SWAP_ACCEPTED',
    'DUTY_ASSIGNED',
    'DUTY_SWAP_REQUESTED'
  ) then
    return public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      request_row.recipient_user_id
    );
  end if;

  if request_row.notification_type = 'FILL_IN_REQUESTED' then
    return exists (
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
  end if;

  if request_row.notification_type = 'FILL_IN_CONFIRMED' then
    return exists (
      select 1
      from public.fill_in_confirmations as confirmation
      join public.guardian_relationships as relationship
        on relationship.player_id = confirmation.player_id
        and relationship.club_id = request_row.club_id
      where confirmation.request_id = request_row.source_id
        and relationship.user_id = request_row.recipient_user_id
        and relationship.active
    );
  end if;

  if request_row.notification_type = 'COACH_CHECKED_IN' then
    return exists (
      select 1
      from public.team_memberships as membership
      where membership.club_id = request_row.club_id
        and membership.team_id = request_row.team_id
        and membership.user_id = request_row.recipient_user_id
        and membership.active
        and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    );
  end if;

  return false;
end;
$$;

create or replace function public.notification_request_push_enabled(
  p_user_id uuid,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select preference.push_enabled
      from public.notification_preferences as preference
      where preference.user_id = p_user_id
        and preference.category = p_category
    ),
    true
  );
$$;

create or replace function public.record_notification_dispatch_skip(
  p_request_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  event_key text;
begin
  if p_reason not in ('REVOKED', 'PREFERENCE', 'NO_ENDPOINT') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found or request_row.status <> 'PENDING' then
    return;
  end if;

  event_key := request_row.notification_type
    || ':' || request_row.source_id::text
    || ':' || request_row.recipient_user_id::text;

  update public.notification_requests
  set status = 'SKIPPED',
      dispatch_claim_id = null,
      dispatch_claimed_at = null,
      dispatch_started_at = null,
      dispatch_endpoint_id = null
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
    p_reason
  )
  on conflict (request_id) do nothing;
end;
$$;

create or replace function public.claim_notification_dispatches(
  p_limit integer default 25
)
returns table (
  request_id uuid,
  claim_id uuid,
  notification_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  endpoint_row public.device_endpoints;
begin
  -- A claim that never entered the send phase is safe to reclaim. A started
  -- claim is deliberately never retried automatically because provider
  -- acceptance may have occurred before a worker/network failure.
  update public.notification_requests as request
  set dispatch_claim_id = null,
      dispatch_claimed_at = null,
      dispatch_endpoint_id = null
  where request.status = 'PENDING'
    and request.dispatch_started_at is null
    and request.dispatch_claimed_at < now() - interval '5 minutes';

  for request_row in
    select request.*
    from public.notification_requests as request
    where request.status = 'PENDING'
      and request.dispatch_claim_id is null
      and not exists (
        select 1
        from public.notification_deliveries as delivery
        where delivery.request_id = request.id
      )
    order by request.created_at, request.id
    limit least(greatest(coalesce(p_limit, 25), 1), 50)
    for update of request skip locked
  loop
    if not public.notification_request_is_current(request_row.id) then
      perform public.record_notification_dispatch_skip(request_row.id, 'REVOKED');
      continue;
    end if;

    if not public.notification_request_push_enabled(
      request_row.recipient_user_id,
      request_row.notification_type
    ) then
      perform public.record_notification_dispatch_skip(request_row.id, 'PREFERENCE');
      continue;
    end if;

    select endpoint.*
    into endpoint_row
    from public.device_endpoints as endpoint
    where endpoint.user_id = request_row.recipient_user_id
      and endpoint.active
    order by endpoint.last_seen_at desc, endpoint.id
    limit 1;

    if not found then
      perform public.record_notification_dispatch_skip(request_row.id, 'NO_ENDPOINT');
      continue;
    end if;

    request_id := request_row.id;
    claim_id := gen_random_uuid();
    notification_type := request_row.notification_type;

    update public.notification_requests
    set dispatch_claim_id = claim_id,
        dispatch_claimed_at = now(),
        dispatch_started_at = null,
        dispatch_endpoint_id = endpoint_row.id
    where id = request_row.id;

    return next;
  end loop;
end;
$$;

create or replace function public.begin_notification_dispatch(
  p_request_id uuid,
  p_claim_id uuid
)
returns table (
  endpoint_id uuid,
  expo_push_token text,
  notification_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  endpoint_row public.device_endpoints;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found
    or request_row.status <> 'PENDING'
    or request_row.dispatch_claim_id is distinct from p_claim_id
    or request_row.dispatch_started_at is not null
  then
    return;
  end if;

  if not public.notification_request_is_current(request_row.id) then
    perform public.record_notification_dispatch_skip(request_row.id, 'REVOKED');
    return;
  end if;

  if not public.notification_request_push_enabled(
    request_row.recipient_user_id,
    request_row.notification_type
  ) then
    perform public.record_notification_dispatch_skip(request_row.id, 'PREFERENCE');
    return;
  end if;

  select endpoint.*
  into endpoint_row
  from public.device_endpoints as endpoint
  where endpoint.id = request_row.dispatch_endpoint_id
    and endpoint.user_id = request_row.recipient_user_id
    and endpoint.active;

  if not found then
    perform public.record_notification_dispatch_skip(request_row.id, 'NO_ENDPOINT');
    return;
  end if;

  update public.notification_requests
  set dispatch_started_at = now()
  where id = request_row.id;

  endpoint_id := endpoint_row.id;
  expo_push_token := endpoint_row.expo_push_token;
  notification_type := request_row.notification_type;
  return next;
end;
$$;

create or replace function public.apply_expo_notification_result(
  p_request_id uuid,
  p_claim_id uuid,
  p_endpoint_id uuid,
  p_result text,
  p_provider_receipt_id text default null,
  p_error_code text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  event_key text;
  delivery_id uuid;
  remaining_endpoints integer;
  normalized_error text;
begin
  if p_result not in ('OK', 'INVALID', 'ERROR') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_result = 'OK'
    and (p_provider_receipt_id is null or char_length(p_provider_receipt_id) > 200)
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if request_row.status <> 'PENDING'
    or request_row.dispatch_claim_id is distinct from p_claim_id
    or request_row.dispatch_endpoint_id is distinct from p_endpoint_id
    or request_row.dispatch_started_at is null
  then
    return request_row.status;
  end if;

  event_key := request_row.notification_type
    || ':' || request_row.source_id::text
    || ':' || request_row.recipient_user_id::text;

  if not public.notification_request_is_current(request_row.id) then
    perform public.record_notification_dispatch_skip(request_row.id, 'REVOKED');
    return 'SKIPPED';
  end if;

  if not public.notification_request_push_enabled(
    request_row.recipient_user_id,
    request_row.notification_type
  ) then
    perform public.record_notification_dispatch_skip(request_row.id, 'PREFERENCE');
    return 'SKIPPED';
  end if;

  if p_result = 'INVALID' then
    normalized_error := case
      when p_error_code = 'DeviceNotRegistered' then 'INVALID'
      else 'PROVIDER'
    end;
    if p_error_code = 'DeviceNotRegistered' then
      update public.device_endpoints as endpoint
      set active = false
      where endpoint.id = p_endpoint_id
        and endpoint.user_id = request_row.recipient_user_id;
    end if;

    select count(*)::integer
    into remaining_endpoints
    from public.device_endpoints as endpoint
    where endpoint.user_id = request_row.recipient_user_id
      and endpoint.active;

    if remaining_endpoints > 0 then
      update public.notification_requests
      set dispatch_claim_id = null,
          dispatch_claimed_at = null,
          dispatch_started_at = null,
          dispatch_endpoint_id = null
      where id = request_row.id;
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
      normalized_error
    )
    on conflict (request_id) do nothing;
    return 'FAILED';
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
      'PROVIDER'
    )
    on conflict (request_id) do nothing;
    return 'FAILED';
  end if;

  update public.notification_requests
  set status = 'SENT'
  where id = request_row.id;

  insert into public.notification_deliveries (
    request_id, user_id, event_key, notification_type, status,
    provider_message_id, sent_at
  )
  values (
    request_row.id,
    request_row.recipient_user_id,
    event_key,
    request_row.notification_type,
    'SENT',
    p_provider_receipt_id,
    now()
  )
  on conflict (request_id) do nothing
  returning id into delivery_id;

  if delivery_id is not null then
    insert into public.notification_provider_receipts (
      delivery_id,
      endpoint_id,
      provider_receipt_id
    )
    values (delivery_id, p_endpoint_id, p_provider_receipt_id)
    on conflict (provider_receipt_id) do nothing;
  end if;

  return 'SENT';
end;
$$;

create or replace function public.claim_notification_provider_receipts(
  p_limit integer default 100
)
returns table (
  provider_receipt_id text,
  endpoint_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select receipt.provider_receipt_id, receipt.endpoint_id
  from public.notification_provider_receipts as receipt
  where receipt.status = 'PENDING'
  order by receipt.created_at, receipt.id
  limit least(greatest(coalesce(p_limit, 100), 1), 1000);
$$;

create or replace function public.apply_notification_provider_receipt(
  p_provider_receipt_id text,
  p_status text,
  p_error_code text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_row public.notification_provider_receipts;
  normalized_error text;
begin
  if p_status not in ('PENDING', 'OK', 'ERROR') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select receipt.*
  into receipt_row
  from public.notification_provider_receipts as receipt
  where receipt.provider_receipt_id = p_provider_receipt_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if receipt_row.status <> 'PENDING' then
    return receipt_row.status;
  end if;

  if p_status = 'PENDING' then
    return 'PENDING';
  end if;

  normalized_error := case
    when p_error_code in (
      'DeviceNotRegistered',
      'MessageTooBig',
      'MessageRateExceeded',
      'MismatchSenderId',
      'InvalidCredentials'
    ) then p_error_code
    when p_status = 'ERROR' then 'ProviderError'
    else null
  end;

  update public.notification_provider_receipts
  set status = p_status,
      error_code = normalized_error,
      checked_at = now()
  where id = receipt_row.id;

  if normalized_error = 'DeviceNotRegistered' then
    update public.device_endpoints as endpoint
    set active = false
    from public.notification_deliveries as delivery
    where delivery.id = receipt_row.delivery_id
      and endpoint.id = receipt_row.endpoint_id
      and endpoint.user_id = delivery.user_id;
  end if;

  return p_status;
end;
$$;

revoke all on function public.notification_request_is_current(uuid)
  from public, anon, authenticated;
revoke all on function public.notification_request_push_enabled(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_notification_dispatch_skip(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_notification_dispatches(integer)
  from public, anon, authenticated;
revoke all on function public.begin_notification_dispatch(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.apply_expo_notification_result(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_notification_provider_receipts(integer)
  from public, anon, authenticated;
revoke all on function public.apply_notification_provider_receipt(text, text, text)
  from public, anon, authenticated;

grant execute on function public.notification_request_is_current(uuid)
  to service_role;
grant execute on function public.notification_request_push_enabled(uuid, text)
  to service_role;
grant execute on function public.record_notification_dispatch_skip(uuid, text)
  to service_role;
grant execute on function public.claim_notification_dispatches(integer)
  to service_role;
grant execute on function public.begin_notification_dispatch(uuid, uuid)
  to service_role;
grant execute on function public.apply_expo_notification_result(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.claim_notification_provider_receipts(integer)
  to service_role;
grant execute on function public.apply_notification_provider_receipt(text, text, text)
  to service_role;
