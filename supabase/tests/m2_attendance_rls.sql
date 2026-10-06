-- Slice 2.4 attendance. Own child, sibling, and staff read. Guardians cannot read the team list.

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
  ('00000000-0000-0000-0000-000000000000', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f3f', 'authenticated', 'authenticated', 'attendance-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1a', 'authenticated', 'authenticated', 'attendance-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', 'authenticated', 'authenticated', 'attendance-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1e', 'authenticated', 'authenticated', 'attendance-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f3f', 'Attendance Admin', 'Attendance', 'Admin'),
  ('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1a', 'Attendance Coach', 'Attendance', 'Coach'),
  ('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', 'Attendance Guardian', 'Attendance', 'Guardian'),
  ('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1e', 'Attendance Outsider', 'Attendance', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Attendance Club', 'attendance-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f3f', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('5c5c5c5c-5c5c-45c5-85c5-5c5c5c5c5c5c', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Attendance Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5c5c5c5c-5c5c-45c5-85c5-5c5c5c5c5c5c', 'Attendance Team', true),
  ('5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5e', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5c5c5c5c-5c5c-45c5-85c5-5c5c5c5c5c5c', 'Other Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1a', 'HEAD_COACH', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Own', 'Child', true),
  ('5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e02', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Sibling', 'Child', true),
  ('5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e03', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Unrelated', 'Child', true),
  ('5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e04', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Other', 'Team', true),
  ('5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e05', '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', 'Revoked', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e02', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e04', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e05', '5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d', false);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e02', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e03', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5e', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e04', true),
  ('5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a', '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d', '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e05', true);

select no_plan();

create temp table issued_event (event_id uuid);
grant all on table issued_event to authenticated;

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f3f'); end $$;
set local role authenticated;

insert into issued_event (event_id)
select public.create_manual_fixture(
  '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
  '5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d',
  '2026-10-10 18:30:00+11',
  null, null, null, null, 'Round 1',
  'Visitors',
  '2026-10-10 18:30:00+11',
  null, null, 'HOME'
);

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d'); end $$;

select lives_ok(
  format(
    'select public.record_attendance(%L, %L, %L, null, %L)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01',
    'ATTENDING',
    'Fever'
  ),
  'a guardian can record their own child'
);
select lives_ok(
  format(
    'select public.record_attendance(%L, %L, %L, %L, null)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e02',
    'UNAVAILABLE',
    'FAMILY'
  ),
  'a guardian can record a sibling'
);
select is(
  pg_temp.sqlstate_of(format(
    'select public.record_attendance(%L, %L, %L, null, null)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e03',
    'ATTENDING'
  )),
  '42501',
  'a guardian cannot record an unrelated child'
);
select is(
  pg_temp.sqlstate_of(format(
    'select public.record_attendance(%L, %L, %L, null, null)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e04',
    'ATTENDING'
  )),
  '42501',
  'a guardian cannot record a child on another team'
);
select is(
  pg_temp.sqlstate_of(format(
    'select public.record_attendance(%L, %L, %L, null, null)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e05',
    'ATTENDING'
  )),
  '42501',
  'a revoked guardian link cannot record attendance'
);

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1e'); end $$;
select is(
  pg_temp.sqlstate_of(format(
    'select public.record_attendance(%L, %L, %L, null, null)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01',
    'ATTENDING'
  )),
  '42501',
  'an outsider cannot record attendance'
);

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d'); end $$;
select lives_ok(
  format(
    'select public.record_attendance(%L, %L, %L, null, %L)',
    (select event_id from issued_event),
    '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01',
    'UNSURE',
    'Fever'
  ),
  'a second response updates the same row'
);

reset role;
select is(
  (select count(*) from public.attendance_responses),
  2::bigint,
  'two players keep two attendance rows'
);
select is(
  (
    select status
    from public.attendance_responses
    where player_id = '5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e01'
  ),
  'UNSURE',
  'the second response replaces the stored status'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'attendance.recorded'
      and club_id = '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a'
  ),
  3::bigint,
  'failed authorization does not write an attendance audit row'
);

set local role authenticated;
do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1a'); end $$;
select is(
  (
    select string_agg(status || coalesce(':' || absence_category, '') || coalesce(':' || private_note, ''), ',' order by player_id)
    from public.list_team_attendance((select event_id from issued_event))
  ),
  'UNSURE:Fever,UNAVAILABLE:FAMILY',
  'staff can read status, category, and the private note'
);

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f1d'); end $$;
select is(
  pg_temp.sqlstate_of(format(
    'select * from public.list_team_attendance(%L)',
    (select event_id from issued_event)
  )),
  '42501',
  'a guardian cannot read team attendance'
);
select is(
  (select own_rsvp from public.read_game_day((select event_id from issued_event))),
  'UNSURE',
  'game day shows the caller''s own RSVP'
);
select is(
  (select attending_count from public.read_game_day((select event_id from issued_event))),
  null,
  'a guardian game day hides staff counts'
);

do $$ begin perform pg_temp.assume_user('5f5f5f5f-5f5f-45f5-85f5-5f5f5f5f5f3f'); end $$;
select is(
  (
    select attending_count::text || ',' || unavailable_count::text || ',' || unsure_count::text || ',' || unanswered_count::text
    from public.read_game_day((select event_id from issued_event))
  ),
  '0,1,1,2',
  'staff game day counts stored responses and unanswered registrations'
);

select throws_ok(
  'select id from public.attendance_responses',
  '42501',
  null,
  'authenticated callers cannot read attendance directly'
);

select ok(
  not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'read_game_day'
      and pg_get_function_result(proc.oid) ilike '%private_note%'
  ),
  'game day does not return a private note'
);

select * from finish();
rollback;
