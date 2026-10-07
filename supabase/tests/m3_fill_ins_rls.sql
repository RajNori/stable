-- Slice 3.5 fill-ins. Masked candidates, one confirmation, official fixture unchanged.

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
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01', 'authenticated', 'authenticated', 'fill-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f02', 'authenticated', 'authenticated', 'fill-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03', 'authenticated', 'authenticated', 'fill-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f04', 'authenticated', 'authenticated', 'fill-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f05', 'authenticated', 'authenticated', 'fill-other-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01', 'Fill Manager', 'Fill', 'Manager'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f02', 'Fill Assistant', 'Fill', 'Assistant'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03', 'Fill Guardian', 'Fill', 'Guardian'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f04', 'Fill Outsider', 'Fill', 'Outsider'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f05', 'Fill Other', 'Fill', 'Other');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Fill Club', 'fill-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('4c4c4c4c-4c4c-44c4-84c4-4c4c4c4c4c4c', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Fill Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4c4c4c4c-4c4c-44c4-84c4-4c4c4c4c4c4c', 'Fill Team', true),
  ('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4e', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4c4c4c4c-4c4c-44c4-84c4-4c4c4c4c4c4c', 'Other Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01', 'TEAM_MANAGER', true),
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f02', 'ASSISTANT_COACH', true),
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4e', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f05', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e01', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Own', 'Child', true),
  ('4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Other', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e01', true);

select no_plan();

create temp table issued_event (event_id uuid);
create temp table issued_request (request_id uuid);
create temp table later_request (request_id uuid);
create temp table closed_request (request_id uuid);
grant all on table issued_event to authenticated;
grant all on table issued_request to authenticated;
grant all on table later_request to authenticated;
grant all on table closed_request to authenticated;

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

insert into issued_event (event_id)
select public.create_manual_fixture(
  '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a',
  '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d',
  '2026-10-10 18:30:00+11',
  null, null, null, null, 'Round 1',
  'Visitors',
  '2026-10-10 18:30:00+11',
  'Court One', 'Court A', 'HOME'
);

select is(
  (select display_name from public.list_fill_in_candidates('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d')),
  'Other C.',
  'a candidate is shown as a first name and surname initial'
);

select is(
  (select count(*)::integer from public.list_fill_in_candidates('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d')),
  1,
  'a player registered to the team is not a candidate'
);

reset role;
do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f02'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.request_fill_in((select event_id from issued_event))
  $sql$),
  'FORBIDDEN',
  'an assistant coach cannot request a fill-in'
);

reset role;
do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f04'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.list_fill_in_candidates('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d')
  $sql$),
  'FORBIDDEN',
  'an outsider cannot list candidates'
);

reset role;
do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f05'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.request_fill_in((select event_id from issued_event))
  $sql$),
  'FORBIDDEN',
  'another team manager cannot request this fill-in'
);

reset role;

create temp table fixture_before as
select
  opponent_name,
  round_label,
  official_start_at,
  official_venue_text,
  official_court_label,
  fixture_status,
  team_score,
  opponent_score
from public.games
where event_id = (select event_id from issued_event);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

insert into issued_request (request_id)
select public.request_fill_in((select event_id from issued_event));

select is(
  public.enqueue_fill_in_requested((select request_id from issued_request)),
  1,
  'the request notifies the candidate guardian'
);

select is(
  public.enqueue_fill_in_requested((select request_id from issued_request)),
  0,
  'a repeated request notification does not double-send'
);

reset role;
do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select request_id from issued_request),
  '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
);
select public.respond_fill_in(
  (select request_id from issued_request),
  '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_responses),
  1,
  'a repeated guardian response stays one row'
);

select is(
  (select count(*)::integer from public.audit_events where action = 'fill_in.responded'),
  1,
  'a repeated response writes one audit row'
);

select ok(
  (select payload::text not like '%Child%'
    from public.notification_requests
    where notification_type = 'FILL_IN_REQUESTED'),
  'the request payload has no child name'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

select public.confirm_fill_in(
  (select request_id from issued_request),
  '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select request_id from issued_request),
      '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
    )
  $sql$),
  'CONFLICT',
  'a second confirmation loses'
);

select is(
  public.enqueue_fill_in_confirmed((select request_id from issued_request)),
  1,
  'confirmation notifies the responding guardian'
);

select is(
  (select fill_in_label from public.read_game_day((select event_id from issued_event))),
  'Other C.',
  'game day shows the masked fill-in'
);

reset role;

select results_eq(
  $$select opponent_name, round_label, official_start_at, official_venue_text,
      official_court_label, fixture_status, team_score, opponent_score
    from public.games
    where event_id = (select event_id from issued_event)$$,
  $$select opponent_name, round_label, official_start_at, official_venue_text,
      official_court_label, fixture_status, team_score, opponent_score
    from fixture_before$$,
  'confirmation does not change the official fixture'
);

update public.guardian_relationships
set active = false
where user_id = '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03';

select is(
  public.apply_notification_provider_result(
    (select id from public.notification_requests where notification_type = 'FILL_IN_CONFIRMED'),
    'ExponentPushToken[fill]',
    'OK'
  ),
  'SKIPPED',
  'a revoked guardian is not pushed'
);

update public.guardian_relationships
set active = true
where user_id = '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03';

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

insert into later_request (request_id)
select public.request_fill_in((select event_id from issued_event));

reset role;
do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select request_id from later_request),
  '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
);

reset role;

update public.fill_in_requests
set status = 'WITHDRAWN'
where id = (select request_id from later_request);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select request_id from later_request),
      '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
    )
  $sql$),
  'CONFLICT',
  'a withdrawn request cannot be confirmed'
);

select public.request_fill_in((select event_id from issued_event));

reset role;

insert into closed_request (request_id)
select id
from public.fill_in_requests
where status = 'OPEN';

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select request_id from closed_request),
  '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
);

reset role;

update public.team_memberships
set active = false
where user_id = '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01';

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select request_id from closed_request),
      '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
    )
  $sql$),
  'FORBIDDEN',
  'a revoked manager cannot confirm'
);

reset role;

update public.team_memberships
set active = true
where user_id = '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01';

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02', true);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select request_id from closed_request),
      '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e02'
    )
  $sql$),
  'VALIDATION_FAILED',
  'a player who became ineligible cannot be confirmed'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_responses where request_id = (select request_id from closed_request)),
  1,
  'the response history stays after a failed confirmation'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f04'); end $$;
set local role authenticated;

select throws_ok(
  $sql$select * from public.fill_in_requests$sql$,
  '42501',
  'permission denied for table fill_in_requests',
  'direct fill-in reads are denied'
);

select * from finish();
rollback;
