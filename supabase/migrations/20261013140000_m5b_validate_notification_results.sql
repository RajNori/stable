-- Reject NULL/blank provider results before trusted notification state changes.

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
  if p_result is null or p_result not in ('OK', 'INVALID', 'ERROR') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_result = 'OK'
    and (p_provider_receipt_id is null
      or p_provider_receipt_id ~ '^[[:space:]]*$'
      or char_length(p_provider_receipt_id) > 200)
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
