-- Slice 3.2 notifications. Devices, preferences, outbox, and send-time checks.

begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

create or replace function pg_temp.sqlerrm_of(command text)
returns text
language plpgsql
as $$
begin
  execute command;
  return 'OK';
exception
  when others then
    return sqlerrm;
end;
$$;

create or replace function pg_temp.assume_user(target uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', target::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', target::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01', 'authenticated', 'authenticated', 'notify-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02', 'authenticated', 'authenticated', 'notify-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03', 'authenticated', 'authenticated', 'notify-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f04', 'authenticated', 'authenticated', 'notify-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01', 'Notify Manager', 'Notify', 'Manager'),
  ('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02', 'Notify Guardian', 'Notify', 'Guardian'),
  ('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03', 'Notify Assistant', 'Notify', 'Assistant'),
  ('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f04', 'Notify Outsider', 'Notify', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', 'Notify Club', 'notify-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('8c8c8c8c-8c8c-48c8-88c8-8c8c8c8c8c8c', '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', 'Notify Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d', '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', '8c8c8c8c-8c8c-48c8-88c8-8c8c8c8c8c8c', 'Notify Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01', 'TEAM_MANAGER', true),
  ('8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03', 'ASSISTANT_COACH', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('8e8e8e8e-8e8e-48e8-88e8-8e8e8e8e8e01', '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', 'Own', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', '8e8e8e8e-8e8e-48e8-88e8-8e8e8e8e8e01', '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a', '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d', '8e8e8e8e-8e8e-48e8-88e8-8e8e8e8e8e01', true);

select no_plan();

create temp table issued_announcement (announcement_id uuid);
create temp table issued_request (recipient_user_id uuid, request_id uuid);
create temp table dispatch_claim (
  request_id uuid,
  claim_id uuid,
  endpoint_id uuid,
  push_token text
);
create temp table dispatch_announcement (announcement_id uuid);
create temp table invalid_dispatch_endpoint (endpoint_id uuid);
create temp table dispatch_test_endpoints (endpoint_id uuid);
grant all on table issued_announcement to authenticated;
grant all on table issued_request to authenticated;
grant all on table dispatch_claim to service_role;
grant all on table dispatch_announcement to authenticated, service_role;
grant all on table invalid_dispatch_endpoint to service_role;
grant all on table dispatch_test_endpoints to authenticated, service_role;

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'); end $$;
set local role authenticated;

insert into issued_announcement (announcement_id)
select public.publish_announcement(
  '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a',
  '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d',
  'DUTY',
  'NORMAL',
  'Secret Child Name',
  'Please arrive early.',
  false
);

select is(
  public.enqueue_announcement_published((select announcement_id from issued_announcement)),
  3,
  'publish enqueues current readers only'
);

select is(
  public.enqueue_announcement_published((select announcement_id from issued_announcement)),
  0,
  'a duplicate announcement event does not enqueue again'
);

reset role;

insert into issued_request (recipient_user_id, request_id)
select recipient_user_id, id
from public.notification_requests;

select is(
  (select count(*) from public.notification_requests where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f04'),
  0::bigint,
  'an outsider is not a recipient'
);

select ok(
  (select payload::text not like '%Secret%' from public.notification_requests limit 1),
  'push payload omits the announcement title'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f04'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.enqueue_announcement_published(
      (select announcement_id from issued_announcement)
    )
  $sql$),
  'FORBIDDEN',
  'an outsider cannot enqueue'
);

reset role;
do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02'); end $$;
set local role authenticated;

select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[guardian-a]', 'IOS')$sql$,
  'guardian registers a device'
);
select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[guardian-b]', 'IOS')$sql$,
  'guardian registers a second device'
);
select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[guardian-b]', 'IOS')$sql$,
  'the owner can register the same token again'
);
select lives_ok(
  $sql$select public.deactivate_device_endpoint('ExponentPushToken[guardian-a]')$sql$,
  'sign-out deactivates only the presented device'
);

reset role;

select is(
  (select active from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-a]'),
  false,
  'the presented device is inactive'
);
select is(
  (select active from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-b]'),
  true,
  'the other device stays active'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.register_device_endpoint('ExponentPushToken[guardian-b]', 'ANDROID')
  $sql$),
  'CONFLICT',
  'an active token owned by someone else is rejected'
);

select is(
  position(
    '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02'
    in pg_temp.sqlerrm_of($sql$
      select public.register_device_endpoint('ExponentPushToken[guardian-b]', 'ANDROID')
    $sql$)
  ),
  0,
  'the rejection does not reveal the current owner'
);

reset role;

select is(
  (select user_id::text from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-b]'),
  '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02',
  'the active token stays with its owner'
);
select is(
  (select platform from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-b]'),
  'IOS',
  'a rejected claim does not change the endpoint'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'); end $$;
set local role authenticated;

select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[guardian-a]', 'IOS')$sql$,
  'a deactivated token can be registered by the next user'
);

reset role;

select is(
  (select user_id::text from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-a]'),
  '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01',
  'sign-out leaves the token free for the next login'
);
select is(
  (select active from public.device_endpoints where expo_push_token = 'ExponentPushToken[guardian-a]'),
  true,
  'the next login reactivates the token'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02'); end $$;
set local role authenticated;

select lives_ok(
  $sql$select public.set_notification_preference('ANNOUNCEMENT_PUBLISHED', false)$sql$,
  'guardian turns the category off'
);

reset role;

select is(
  public.apply_notification_provider_result(
    (select request_id from issued_request where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f02'),
    'ExponentPushToken[guardian-a]',
    'OK'
  ),
  'SKIPPED',
  'a disabled preference is not bypassed'
);

update public.team_memberships
set active = false
where user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01';

select is(
  public.apply_notification_provider_result(
    (select request_id from issued_request where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'),
    'ExponentPushToken[guardian-b]',
    'OK'
  ),
  'SKIPPED',
  'a revoked reader is not pushed'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'); end $$;
set local role authenticated;

select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[assistant-a]', 'IOS')$sql$,
  'assistant registers a device'
);
select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[assistant-b]', 'IOS')$sql$,
  'assistant registers another device'
);

reset role;

select is(
  public.apply_notification_provider_result(
    (select request_id from issued_request where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'),
    'ExponentPushToken[assistant-a]',
    'INVALID'
  ),
  'PENDING',
  'an invalid token is dropped while another device remains'
);

select is(
  (select active from public.device_endpoints where expo_push_token = 'ExponentPushToken[assistant-a]'),
  false,
  'the invalid token is deactivated'
);

select is(
  public.apply_notification_provider_result(
    (select request_id from issued_request where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'),
    'ExponentPushToken[assistant-b]',
    'OK'
  ),
  'SENT',
  'a remaining device can still be sent'
);

select is(
  public.apply_notification_provider_result(
    (select request_id from issued_request where recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'),
    'ExponentPushToken[assistant-b]',
    'OK'
  ),
  'SENT',
  'a second send does not create another delivery'
);

select is(
  (select count(*) from public.notification_deliveries where user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'),
  1::bigint,
  'the delivery key stays unique'
);

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'); end $$;
set local role authenticated;

select throws_ok(
  $sql$select * from public.device_endpoints$sql$,
  '42501',
  'permission denied for table device_endpoints',
  'device tokens are not readable'
);

select throws_ok(
  $sql$
    select public.apply_notification_provider_result(
      '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03',
      'ExponentPushToken[assistant-b]',
      'OK'
    )
  $sql$,
  '42501',
  'permission denied for function apply_notification_provider_result',
  'authenticated callers cannot apply provider results'
);

reset role;
update public.team_memberships
set active = true
where user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01';

do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'); end $$;
set local role authenticated;

insert into dispatch_test_endpoints (endpoint_id)
values
  (public.register_device_endpoint('ExponentPushToken[dispatch-one]', 'IOS')),
  (public.register_device_endpoint('ExponentPushToken[dispatch-two]', 'IOS'));
select is(
  (select count(*)::integer from dispatch_test_endpoints),
  2,
  'manager registers two dispatcher test endpoints'
);

insert into dispatch_announcement (announcement_id)
values (
  public.publish_announcement(
    '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a',
    '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d',
    'GENERAL',
    'NORMAL',
    'Dispatch test',
    'Synthetic dispatcher test.',
    false
  )
);
select public.enqueue_announcement_published(
  (select announcement_id from dispatch_announcement)
);

reset role;

-- Other earlier notification checks may have registered active endpoints for
-- this user. Make the intended dispatch test endpoint unambiguously newest so
-- the claim exercises the endpoint set asserted below, regardless of random
-- UUID ordering or transaction timestamp ties.
update public.device_endpoints
set last_seen_at = now() + interval '1 second'
where id = (
  select endpoint_id
  from dispatch_test_endpoints
  order by endpoint_id
  limit 1
);

set local role service_role;
insert into dispatch_claim (request_id, claim_id)
select request_id, claim_id
from public.claim_notification_dispatches(25)
where request_id = (
  select request.id
  from public.notification_requests as request
  join dispatch_announcement as announcement
    on announcement.announcement_id = request.source_id
  where request.recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'
  order by request.created_at desc
  limit 1
);

select is(
  (select count(*)::integer from dispatch_claim),
  1,
  'the trusted worker atomically claims the pending manager notice'
);
select is(
  (
    select count(*)::integer
    from public.claim_notification_dispatches(25) as second_claim
    where second_claim.request_id = (select request_id from dispatch_claim)
  ),
  0,
  'a second claim cannot claim the same in-flight notice'
);

update dispatch_claim as claim
set endpoint_id = started.endpoint_id,
    push_token = started.expo_push_token
from public.begin_notification_dispatch(
  (select request_id from dispatch_claim),
  (select claim_id from dispatch_claim)
) as started;

select ok(
  (select endpoint_id is not null and push_token is not null from dispatch_claim),
  'the send phase rechecks eligibility before returning an endpoint token'
);
select ok(
  (select endpoint_id in (select endpoint_id from dispatch_test_endpoints) from dispatch_claim),
  'dispatch selects one of the endpoints created for this test'
);
insert into invalid_dispatch_endpoint (endpoint_id)
select endpoint_id from dispatch_claim;

select is(
  public.apply_expo_notification_result(
    (select request_id from dispatch_claim),
    (select claim_id from dispatch_claim),
    (select endpoint_id from dispatch_claim),
    'INVALID',
    null,
    'DeviceNotRegistered'
  ),
  'PENDING',
  'an invalid endpoint is disabled and work remains pending for another device'
);

select is(
  (
    select count(*)::integer
    from public.device_endpoints as endpoint
    where endpoint.user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'
      and endpoint.id in (select endpoint_id from dispatch_test_endpoints)
      and endpoint.active
  ),
  1,
  'invalid endpoint feedback disables only that device'
);

delete from dispatch_claim;
insert into dispatch_claim (request_id, claim_id)
select request_id, claim_id
from public.claim_notification_dispatches(25)
where request_id = (
  select request.id
  from public.notification_requests as request
  join dispatch_announcement as announcement
    on announcement.announcement_id = request.source_id
  where request.recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'
    and request.notification_type = 'ANNOUNCEMENT_PUBLISHED'
  limit 1
);

update dispatch_claim as claim
set endpoint_id = started.endpoint_id,
    push_token = started.expo_push_token
from public.begin_notification_dispatch(
  (select request_id from dispatch_claim),
  (select claim_id from dispatch_claim)
) as started;

select isnt(
  (select endpoint_id from dispatch_claim),
  (select endpoint_id from invalid_dispatch_endpoint),
  'retry selects the remaining active device, not the invalid endpoint'
);

select throws_ok(
  $sql$
    select public.apply_expo_notification_result(
      (select request_id from dispatch_claim),
      (select claim_id from dispatch_claim),
      (select endpoint_id from dispatch_claim),
      null,
      'null-result-must-not-send',
      null
    )
  $sql$,
  '23514',
  'VALIDATION_FAILED',
  'a NULL provider result is rejected'
);
select throws_ok(
  $sql$
    select public.apply_expo_notification_result(
      (select request_id from dispatch_claim),
      (select claim_id from dispatch_claim),
      (select endpoint_id from dispatch_claim),
      'OK',
      '   ',
      null
    )
  $sql$,
  '23514',
  'VALIDATION_FAILED',
  'an empty provider receipt is rejected'
);
select is(
  (
    select status
    from public.notification_requests
    where id = (select request_id from dispatch_claim)
  ),
  'PENDING',
  'invalid provider results leave the notification pending'
);

select is(
  public.apply_expo_notification_result(
    (select request_id from dispatch_claim),
    (select claim_id from dispatch_claim),
    (select endpoint_id from dispatch_claim),
    'OK',
    'expo-receipt-dispatch-test',
    null
  ),
  'SENT',
  'successful Expo acceptance is recorded once'
);
select is(
  (
    select provider_message_id
    from public.notification_deliveries
    where request_id = (select request_id from dispatch_claim)
  ),
  'expo-receipt-dispatch-test',
  'the provider receipt id is retained without message content'
);
select is(
  public.apply_expo_notification_result(
    (select request_id from dispatch_claim),
    (select claim_id from dispatch_claim),
    (select endpoint_id from dispatch_claim),
    'OK',
    'duplicate-receipt',
    null
  ),
  'SENT',
  'a repeated worker completion cannot create another delivery'
);

create temporary table claimed_provider_receipt on commit drop as
select *
from public.claim_notification_provider_receipts(100)
where provider_receipt_id = 'expo-receipt-dispatch-test';

select is(
  (select count(*)::integer from claimed_provider_receipt),
  1,
  'a successful ticket is claimed for provider receipt polling'
);
select is(
  (
    select count(*)::integer
    from public.claim_notification_provider_receipts(100) as receipt
    where receipt.provider_receipt_id = 'expo-receipt-dispatch-test'
  ),
  0,
  'a concurrent receipt collector cannot claim an in-flight receipt'
);
select is(
  public.apply_notification_provider_receipt(
    'expo-receipt-dispatch-test',
    'ERROR',
    'DeviceNotRegistered'
  ),
  'STALE',
  'the legacy receipt RPC cannot apply an unfenced provider result'
);
select throws_ok(
  $sql$
    select public.apply_notification_provider_receipt(
      'expo-receipt-dispatch-test',
      (select claim_id from claimed_provider_receipt),
      null,
      null
    )
  $sql$,
  '23514',
  'VALIDATION_FAILED',
  'a NULL receipt status is rejected'
);
update public.notification_provider_receipts
set claimed_at = now() - interval '11 minutes'
where provider_receipt_id = 'expo-receipt-dispatch-test';

create temporary table reclaimed_provider_receipt on commit drop as
select *
from public.claim_notification_provider_receipts(100)
where provider_receipt_id = 'expo-receipt-dispatch-test';

select is(
  (select count(*)::integer from reclaimed_provider_receipt),
  1,
  'an expired provider receipt lease can be reclaimed'
);
select isnt(
  (select claim_id from reclaimed_provider_receipt),
  (select claim_id from claimed_provider_receipt),
  'reclaiming a receipt issues a new fencing claim'
);
select is(
  public.apply_notification_provider_receipt(
    'expo-receipt-dispatch-test',
    (select claim_id from claimed_provider_receipt),
    'ERROR',
    'DeviceNotRegistered'
  ),
  'STALE',
  'a stale collector cannot apply a result after lease takeover'
);
select is(
  public.apply_notification_provider_receipt(
    'expo-receipt-dispatch-test',
    (select claim_id from reclaimed_provider_receipt),
    'ERROR',
    'DeviceNotRegistered'
  ),
  'ERROR',
  'the current receipt claim can apply a sanitized provider error'
);

create or replace function pg_temp.notification_race_db_link()
returns text
language sql
as $$
  select format(
    'host=%s port=5432 dbname=postgres user=postgres password=postgres',
    host(inet_server_addr())
  );
$$;

select extensions.dblink_connect(
  'receipt_fixture_setup',
  pg_temp.notification_race_db_link()
);
select extensions.dblink_exec(
  'receipt_fixture_setup',
  $setup$
    do $body$
    begin
      delete from public.notification_provider_receipts
      where provider_receipt_id = 'expo-receipt-parallel-claim-test';
      delete from public.notification_deliveries
      where event_key = 'receipt-parallel-claim-test';
      delete from public.notification_requests
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03';
      delete from public.device_endpoints
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02';
      delete from public.profiles
      where user_id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01';
      delete from auth.users
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01';

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01',
        'authenticated', 'authenticated', 'receipt-race@local.stable.test', '',
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      );
      insert into public.profiles (user_id, display_name, first_name, last_name)
      values (
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01',
        'Receipt Race', 'Receipt', 'Race'
      );
      insert into public.device_endpoints (id, user_id, platform, expo_push_token)
      values (
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02',
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01',
        'IOS', 'ExponentPushToken[receipt-parallel-claim-test]'
      );
      insert into public.notification_requests (
        id, club_id, team_id, notification_type, source_id,
        recipient_user_id, payload, status
      ) values (
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03',
        '11111111-1111-4111-8111-111111111111',
        '99999999-9999-4999-8999-999999999999',
        'GAME_REMINDER', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f04',
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01', '{}', 'SENT'
      );
      insert into public.notification_deliveries (
        request_id, user_id, event_key, notification_type, status,
        provider_message_id, sent_at
      ) values (
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03',
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01',
        'receipt-parallel-claim-test', 'GAME_REMINDER', 'SENT',
        'expo-ticket-parallel-claim-test', now()
      );
      insert into public.notification_provider_receipts (
        delivery_id, endpoint_id, provider_receipt_id
      ) values (
        (
          select delivery.id from public.notification_deliveries as delivery
          where delivery.event_key = 'receipt-parallel-claim-test'
        ),
        '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02',
        'expo-receipt-parallel-claim-test'
      );
    end
    $body$;
  $setup$
);

select extensions.dblink_connect(
  'receipt_race_a',
  pg_temp.notification_race_db_link()
);
select extensions.dblink_connect(
  'receipt_race_b',
  pg_temp.notification_race_db_link()
);
select extensions.dblink_send_query(
  'receipt_race_a',
  $race$
    select count(*)::integer, min(claim_id::text)
    from public.claim_notification_provider_receipts(10)
    where provider_receipt_id = 'expo-receipt-parallel-claim-test'
  $race$
);
select extensions.dblink_send_query(
  'receipt_race_b',
  $race$
    select count(*)::integer, min(claim_id::text)
    from public.claim_notification_provider_receipts(10)
    where provider_receipt_id = 'expo-receipt-parallel-claim-test'
  $race$
);

create temporary table parallel_receipt_claims (
  collector text primary key,
  claimed_count integer not null,
  claim_id text
);
insert into parallel_receipt_claims (collector, claimed_count, claim_id)
select 'a', result.claimed_count, result.claim_id
from extensions.dblink_get_result('receipt_race_a') as result(
  claimed_count integer,
  claim_id text
);
insert into parallel_receipt_claims (collector, claimed_count, claim_id)
select 'b', result.claimed_count, result.claim_id
from extensions.dblink_get_result('receipt_race_b') as result(
  claimed_count integer,
  claim_id text
);
select is(
  (select sum(claimed_count)::integer from parallel_receipt_claims),
  1,
  'two concurrent receipt collectors claim a receipt at most once'
);
select is(
  (select count(*)::integer from parallel_receipt_claims where claim_id is not null),
  1,
  'exactly one concurrent receipt collector receives the active claim id'
);

select extensions.dblink_exec(
  'receipt_fixture_setup',
  $cleanup$
    do $body$
    begin
      delete from public.notification_provider_receipts
      where provider_receipt_id = 'expo-receipt-parallel-claim-test';
      delete from public.notification_deliveries
      where event_key = 'receipt-parallel-claim-test';
      delete from public.notification_requests
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03';
      delete from public.device_endpoints
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02';
      delete from public.profiles
      where user_id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01';
      delete from auth.users
      where id = '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01';
    end
    $body$;
  $cleanup$
);
select extensions.dblink_disconnect('receipt_race_a');
select extensions.dblink_disconnect('receipt_race_b');
select extensions.dblink_disconnect('receipt_fixture_setup');
select is(
  (
    select active
    from public.device_endpoints
    where id = (select endpoint_id from dispatch_claim)
  ),
  false,
  'an invalid-device receipt deactivates only its endpoint'
);

delete from dispatch_announcement;
reset role;
do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'); end $$;
set local role authenticated;
select lives_ok(
  $sql$select public.register_device_endpoint('ExponentPushToken[dispatch-three]', 'IOS')$sql$,
  'manager registers a fresh endpoint for revocation acceptance'
);

delete from dispatch_announcement;
insert into dispatch_announcement (announcement_id)
values (
  public.publish_announcement(
    '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a',
    '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d',
    'GENERAL',
    'NORMAL',
    'Revocation test',
    'Synthetic revocation test.',
    false
  )
);
select public.enqueue_announcement_published(
  (select announcement_id from dispatch_announcement)
);
reset role;

set local role service_role;
delete from dispatch_claim;
insert into dispatch_claim (request_id, claim_id)
select request_id, claim_id
from public.claim_notification_dispatches(25)
where request_id = (
  select request.id
  from public.notification_requests as request
  join dispatch_announcement as announcement
    on announcement.announcement_id = request.source_id
  where request.recipient_user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01'
  order by request.created_at desc
  limit 1
);
reset role;

update public.team_memberships
set active = false
where user_id = '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f01';

set local role service_role;
select is(
  (
    select count(*)::integer
    from public.begin_notification_dispatch(
      (select request_id from dispatch_claim),
      (select claim_id from dispatch_claim)
    )
  ),
  0,
  'send-time authorization prevents delivery after membership revocation'
);
select is(
  (
    select status
    from public.notification_requests
    where id = (select request_id from dispatch_claim)
  ),
  'SKIPPED',
  'revoked work is explicitly marked skipped'
);

reset role;
do $$ begin perform pg_temp.assume_user('8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f03'); end $$;
set local role authenticated;
select throws_ok(
  $sql$select * from public.claim_notification_dispatches(1)$sql$,
  '42501',
  'permission denied for function claim_notification_dispatches',
  'authenticated callers cannot claim trusted delivery work'
);

select * from finish();
rollback;
