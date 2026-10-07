-- Slice 3.2 notifications. Devices, preferences, outbox, and send-time checks.

begin;

create extension if not exists pgtap with schema extensions;

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
grant all on table issued_announcement to authenticated;
grant all on table issued_request to authenticated;

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

select * from finish();
rollback;
