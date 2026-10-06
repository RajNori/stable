-- Slice 2.3 game day. Own duty, staff counts, one assignment. No swap.

begin;

create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.sqlstate_of(command text)
returns text
language plpgsql
as $$
begin
  execute command;
  return 'OK';
exception
  when others then
    return sqlstate;
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
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f3f', 'authenticated', 'authenticated', 'gameday-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1a', 'authenticated', 'authenticated', 'gameday-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1c', 'authenticated', 'authenticated', 'gameday-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d', 'authenticated', 'authenticated', 'gameday-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1e', 'authenticated', 'authenticated', 'gameday-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f3f', 'Game Day Admin', 'Game', 'Admin'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1a', 'Game Day Coach', 'Game', 'Coach'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1c', 'Game Day Manager', 'Game', 'Manager'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d', 'Game Day Guardian', 'Game', 'Guardian'),
  ('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1e', 'Game Day Outsider', 'Game', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Game Day Club', 'game-day-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f3f', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('4c4c4c4c-4c4c-44c4-84c4-4c4c4c4c4c4c', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Game Day Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4c4c4c4c-4c4c-44c4-84c4-4c4c4c4c4c4c', 'Game Day Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1a', 'HEAD_COACH', true),
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1c', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e4e', '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', 'Synthetic', 'Player', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e4e', '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a', '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', '4e4e4e4e-4e4e-44e4-84e4-4e4e4e4e4e4e', true);

select no_plan();

create temp table issued_game (event_id uuid);
grant all on table issued_game to authenticated;

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f3f'); end $$;
set local role authenticated;

insert into issued_game (event_id)
select public.create_manual_fixture(
  '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a',
  '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d',
  '2026-10-10 18:30:00+11',
  null, null, null, null, 'Round 1',
  'Visitors',
  '2026-10-10 18:30:00+11',
  null, null, 'HOME'
);

select is(
  (select own_rsvp from public.read_game_day((select event_id from issued_game))),
  'UNANSWERED',
  'a game day has no stored RSVP yet'
);
select is(
  (select unanswered_count from public.read_game_day((select event_id from issued_game))),
  1,
  'staff see the unanswered registration count'
);
select is(
  (select attending_count from public.read_game_day((select event_id from issued_game))),
  0,
  'staff attending count starts at zero'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d'); end $$;
select is(
  (select own_rsvp from public.read_game_day((select event_id from issued_game))),
  'UNANSWERED',
  'a guardian can read their own unanswered RSVP'
);
select is(
  (select attending_count from public.read_game_day((select event_id from issued_game))),
  null,
  'a guardian does not receive staff attendance counts'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1e'); end $$;
select is(
  pg_temp.sqlstate_of(format(
    'select public.read_game_day(%L)',
    (select event_id from issued_game)
  )),
  '42501',
  'an outsider cannot read game day'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1a'); end $$;
select is(
  pg_temp.sqlstate_of(format(
    'select public.assign_game_duty(%L, %L, %L, %L)',
    (select event_id from issued_game),
    'SCORER',
    'Scorebook',
    '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d'
  )),
  '42501',
  'a head coach cannot assign a duty'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1c'); end $$;
select lives_ok(
  format(
    'select public.assign_game_duty(%L, %L, %L, %L)',
    (select event_id from issued_game),
    'SCORER',
    'Scorebook',
    '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d'
  ),
  'a team manager can assign one duty'
);

do $$ begin perform pg_temp.assume_user('4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1d'); end $$;
select is(
  (select own_duty_label from public.read_game_day((select event_id from issued_game))),
  'Scorebook',
  'the assignee reads their own duty'
);
select is(
  (select own_duty_status from public.read_game_day((select event_id from issued_game))),
  'ASSIGNED',
  'the assigned duty is not acknowledged'
);

select throws_ok(
  'select id from public.duties',
  '42501',
  null,
  'authenticated callers cannot read duties directly'
);

reset role;
select is(
  (
    select action
    from public.audit_events
    where action = 'duty.assigned'
      and club_id = '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a'
  ),
  'duty.assigned',
  'assigning a duty writes one audit row'
);
select is(
  (
    select actor_user_id::text
    from public.audit_events
    where action = 'duty.assigned'
      and club_id = '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a'
  ),
  '4f4f4f4f-4f4f-44f4-84f4-4f4f4f4f4f1c',
  'the duty audit records the assigning manager'
);

select * from finish();
rollback;
