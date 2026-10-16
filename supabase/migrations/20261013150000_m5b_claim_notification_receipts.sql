-- Lease pending provider receipts so concurrent collectors do not poll the same IDs.
alter table public.notification_provider_receipts
  add column claim_id uuid,
  add column claimed_at timestamptz;

create or replace function public.claim_notification_provider_receipts(
  p_limit integer default 100
)
returns table (
  provider_receipt_id text,
  endpoint_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select receipt.id
    from public.notification_provider_receipts as receipt
    where receipt.status = 'PENDING'
      and (
        receipt.claim_id is null
        or receipt.claimed_at < now() - interval '10 minutes'
      )
    order by receipt.created_at, receipt.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  )
  update public.notification_provider_receipts as receipt
  set claim_id = gen_random_uuid(),
      claimed_at = clock_timestamp()
  from candidates
  where receipt.id = candidates.id
  returning receipt.provider_receipt_id, receipt.endpoint_id;
end;
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
  if p_status is null or p_status not in ('PENDING', 'OK', 'ERROR') then
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
    update public.notification_provider_receipts
    set claim_id = null,
        claimed_at = null
    where id = receipt_row.id;
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
      claim_id = null,
      claimed_at = null,
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

revoke all on function public.claim_notification_provider_receipts(integer)
  from public, anon, authenticated;
revoke all on function public.apply_notification_provider_receipt(text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_notification_provider_receipts(integer)
  to service_role;
grant execute on function public.apply_notification_provider_receipt(text, text, text)
  to service_role;
