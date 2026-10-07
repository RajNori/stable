-- Duty assignment and targeted swap requests enqueue one safe notice.

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
  ('00000000-0000-0000-0000-000000000000', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201', 'authenticated', 'authenticated', 'notice-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202', 'authenticated', 'authenticated', 'notice-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d203', 'authenticated', 'authenticated', 'notice-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d204', 'authenticated', 'authenticated', 'notice-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201', 'Notice Manager', 'Notice', 'Manager'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202', 'Notice Guardian', 'Notice', 'Guardian'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d203', 'Notice Head', 'Notice', 'Head'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d204', 'Notice Outsider', 'Notice', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'Notice Club', 'notice-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2c1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'Notice Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2c1', 'Notice Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201', 'TEAM_MANAGER', true),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d203', 'HEAD_COACH', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2e1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'Own', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2e1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2e1', true);

insert into public.events (id, club_id, team_id, event_type, starts_at, status)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'GAME', '2026-10-10 18:30:00+11', 'SCHEDULED'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b2', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'GAME', '2026-10-17 18:30:00+11', 'SCHEDULED'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b3', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'GAME', '2026-10-24 18:30:00+11', 'SCHEDULED'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b4', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'GAME', '2026-10-31 18:30:00+11', 'SCHEDULED'),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b5', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'GAME', '2026-11-07 18:30:00+11', 'SCHEDULED');

insert into public.duties (id, club_id, team_id, event_id, duty_type, label)
values
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2f1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1', 'SCORER', 'Score');

select no_plan();

create temp table captured (label text primary key, value text);
grant all on table captured to authenticated;

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

insert into captured (label, value)
select 'preview', public.duty_allocation_fingerprint('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1');

select is(
  (public.list_duty_allocation_inputs('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1') is not null),
  true,
  'allocation preview can be read'
);

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and team_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1'),
  0,
  'allocation preview does not enqueue'
);

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select lives_ok(
  $sql$
    select public.commit_duty_allocation(
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1',
      (select value from captured where label = 'preview')
    )
  $sql$,
  'allocation commit assigns the open duty'
);

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2f1'),
  1,
  'allocation commit enqueues one assignment notice'
);

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.commit_duty_allocation(
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b1',
      (select value from captured where label = 'preview')
    )
  $sql$),
  'CONFLICT',
  'a repeated allocation commit is rejected'
);

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2f1'),
  1,
  'a repeated allocation commit does not enqueue again'
);

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

insert into captured (label, value)
select 'manual', public.assign_game_duty(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b2',
  'CLOCK',
  'Clock',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'
)::text;

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = (select value::uuid from captured where label = 'manual')),
  1,
  'manual assignment enqueues once'
);

select is(
  (select recipient_user_id::text from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = (select value::uuid from captured where label = 'manual')),
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201',
  'the assignment notice goes only to the assigned user'
);

select is(
  (select payload from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = (select value::uuid from captured where label = 'manual')),
  jsonb_build_object(
    'notificationType', 'DUTY_ASSIGNED',
    'teamId', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1',
    'dutyId', (select value::uuid from captured where label = 'manual')
  ),
  'the assignment payload has no child or contact data'
);

reset role;

select public.enqueue_duty_notification(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2a1',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1',
  'DUTY_ASSIGNED',
  (select value::uuid from captured where label = 'manual'),
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201',
  jsonb_build_object(
    'notificationType', 'DUTY_ASSIGNED',
    'teamId', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1',
    'dutyId', (select value::uuid from captured where label = 'manual')
  )
);

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_ASSIGNED'
      and source_id = (select value::uuid from captured where label = 'manual')),
  1,
  'a repeated assignment notice does not duplicate'
);

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select public.assign_game_duty(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b3',
  'CANTEEN',
  'Canteen',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202'
);

reset role;
do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202'); end $$;
set local role authenticated;

insert into captured (label, value)
select 'swap', public.request_duty_swap(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b3',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'
)::text;

select ok(
  pg_temp.sqlerrm_of($sql$
    select public.request_duty_swap(
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b3',
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'
    )
  $sql$) <> 'OK',
  'a second swap request for the same duty is rejected'
);

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_SWAP_REQUESTED'
      and source_id = (select value::uuid from captured where label = 'swap')),
  1,
  'a targeted swap request enqueues once'
);

select is(
  (select recipient_user_id::text from public.notification_requests
    where notification_type = 'DUTY_SWAP_REQUESTED'
      and source_id = (select value::uuid from captured where label = 'swap')),
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201',
  'the swap notice goes only to the named target'
);

select is(
  (select payload from public.notification_requests
    where notification_type = 'DUTY_SWAP_REQUESTED'
      and source_id = (select value::uuid from captured where label = 'swap')),
  jsonb_build_object(
    'notificationType', 'DUTY_SWAP_REQUESTED',
    'teamId', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1',
    'requestId', (select value::uuid from captured where label = 'swap')
  ),
  'the swap payload has no child or contact data'
);

reset role;
do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select public.assign_game_duty(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b4',
  'OTHER',
  'Door',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'
);

insert into captured (label, value)
select 'open-swap', public.request_duty_swap(
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b4',
  null
)::text;

reset role;

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'DUTY_SWAP_REQUESTED'
      and source_id = (select value::uuid from captured where label = 'open-swap')),
  0,
  'an open swap request does not invent recipients'
);

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.assign_game_duty(
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b5',
      'SCORER',
      'Score',
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d204'
    )
  $sql$),
  'VALIDATION_FAILED',
  'an ineligible assignment is rejected'
);

reset role;

update public.guardian_relationships
set active = false
where user_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202';

do $$ begin perform pg_temp.assume_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d201'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.assign_game_duty(
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b5',
      'CLOCK',
      'Clock',
      'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d202'
    )
  $sql$),
  'VALIDATION_FAILED',
  'a revoked guardian cannot be assigned'
);

reset role;

select is(
  (select count(*)::integer from public.duties
    where event_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2b5'),
  0,
  'ineligible assignments are not stored'
);

select is(
  (select count(*)::integer from public.notification_requests as request
    where request.notification_type = 'DUTY_ASSIGNED'
      and request.team_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d1'
      and not exists (
        select 1
        from public.duties as duty
        where duty.id = request.source_id
      )),
  0,
  'ineligible assignment mutations enqueue nothing'
);

select * from finish();
rollback;
