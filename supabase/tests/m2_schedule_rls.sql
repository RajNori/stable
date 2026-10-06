-- Slice 2.2 schedule. One events agenda, including a training row.

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
  ('00000000-0000-0000-0000-000000000000', '3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f3f', 'authenticated', 'authenticated', 'schedule-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f1e', 'authenticated', 'authenticated', 'schedule-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f3f', 'Schedule Admin', 'Schedule', 'Admin'),
  ('3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f1e', 'Schedule Outsider', 'Schedule', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a', 'Schedule Club', 'schedule-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a', '3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f3f', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('3c3c3c3c-3c3c-43c3-83c3-3c3c3c3c3c3c', '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a', 'Schedule Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d', '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a', '3c3c3c3c-3c3c-43c3-83c3-3c3c3c3c3c3c', 'Schedule Team', true);

insert into public.events (
  id, club_id, team_id, event_type, starts_at, status
)
values (
  '3e3e3e3e-3e3e-43e3-83e3-3e3e3e3e3e3e',
  '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a',
  '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
  'TRAINING',
  '2026-10-12 18:00:00+11',
  'SCHEDULED'
);

select no_plan();

create temp table issued_schedule (event_id uuid);
grant all on table issued_schedule to authenticated;

do $$ begin perform pg_temp.assume_user('3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f3f'); end $$;
set local role authenticated;

insert into issued_schedule (event_id)
select public.create_manual_fixture(
  '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a',
  '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
  '2026-10-10 18:30:00+11',
  null, null, null, null, 'Round 1',
  'Visitors',
  '2026-10-10 18:30:00+11',
  null, null, 'HOME'
);

select is(
  (
    select string_agg(event_type, ',' order by starts_at, event_id)
    from public.list_team_schedule(
      '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
      '2026-10-01 00:00:00+11',
      '2026-10-31 23:59:59+11',
      null
    )
  ),
  'GAME,TRAINING',
  'games and training share one agenda ordered by start'
);
select is(
  (
    select event_type
    from public.list_team_schedule(
      '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
      '2026-10-01 00:00:00+11',
      '2026-10-31 23:59:59+11',
      'TRAINING'
    )
  ),
  'TRAINING',
  'the agenda can filter to training without a second calendar'
);
select is(
  (
    select count(*)
    from public.list_team_schedule(
      '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
      '2020-01-01 00:00:00+11',
      '2020-01-02 00:00:00+11',
      null
    )
  ),
  0::bigint,
  'an empty range returns no rows'
);
select is(
  pg_temp.sqlerrm_of($$
    select public.list_team_schedule(
      '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
      '2026-10-31 00:00:00+11',
      '2026-10-01 00:00:00+11',
      null
    )
  $$),
  'VALIDATION_FAILED',
  'an inverted range fails validation'
);
reset role;

do $$ begin perform pg_temp.assume_user('3f3f3f3f-3f3f-43f3-83f3-3f3f3f3f3f1e'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.list_team_schedule(
      '3d3d3d3d-3d3d-43d3-83d3-3d3d3d3d3d3d',
      '2026-10-01 00:00:00+11',
      '2026-10-31 23:59:59+11',
      null
    )
  $$),
  'FORBIDDEN',
  'an outsider cannot read another team agenda'
);
reset role;

select is_empty(
  $$
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('team_schedule', 'schedule_events')
  $$,
  'the agenda does not add a second schedule table'
);

select * from finish();

rollback;
