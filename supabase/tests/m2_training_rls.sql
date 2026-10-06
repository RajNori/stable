-- Slice 2.5 training recurrence, detachment, and coach check-in.

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
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f3f', 'authenticated', 'authenticated', 'training-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1a', 'authenticated', 'authenticated', 'training-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b', 'authenticated', 'authenticated', 'training-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c', 'authenticated', 'authenticated', 'training-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1e', 'authenticated', 'authenticated', 'training-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f3f', 'Training Admin', 'Training', 'Admin'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1a', 'Training Head', 'Training', 'Head'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b', 'Training Assistant', 'Training', 'Assistant'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c', 'Training Manager', 'Training', 'Manager'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1e', 'Training Outsider', 'Training', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Training Club', 'training-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f3f', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Training Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', 'Training Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1a', 'HEAD_COACH', true),
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b', 'ASSISTANT_COACH', true),
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c', 'TEAM_MANAGER', true);

select no_plan();

create temp table issued (kind text primary key, id uuid);
grant all on table issued to authenticated;

create function pg_temp.series_event(series uuid, moment timestamptz)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select event.id
  from public.events as event
  where event.recurrence_series_id = series
    and event.starts_at = moment;
$$;

create function pg_temp.training_start(series uuid, local_day date)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  select event.starts_at
  from public.events as event
  where event.recurrence_series_id is not distinct from series
    and event.team_id = '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d'
    and (event.starts_at at time zone 'Australia/Melbourne')::date = local_day
  order by event.starts_at
  limit 1;
$$;

create function pg_temp.series_count(series uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select count(*)
  from public.events as event
  where event.recurrence_series_id = series;
$$;

create function pg_temp.series_end(series uuid)
returns date
language sql
security definer
set search_path = ''
as $$
  select series_row.ends_on
  from public.recurrence_series as series_row
  where series_row.id = series;
$$;

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlstate_of($sql$
    select public.create_training_session(
      '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
      '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
      '2026-10-14 18:30:00+11',
      null, null, null
    )
  $sql$),
  '42501',
  'an assistant coach cannot manage training'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c'); end $$;
select is(
  pg_temp.sqlstate_of($sql$
    select public.create_training_session(
      '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
      '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
      '2026-10-14 18:30:00+11',
      null, null,
      '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c'
    )
  $sql$),
  '23514',
  'a lead coach must be an active coach'
);

insert into issued (kind, id)
select 'once', public.create_training_session(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  '2026-10-14 18:30:00+11',
  null, 'Court 1',
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b'
);

select is(
  (
    select event_type
    from public.list_team_schedule(
      '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
      '2026-10-01 00:00:00+11',
      '2026-10-31 23:59:59+11',
      'TRAINING'
    )
    where event_id = (select id from issued where kind = 'once')
  ),
  'TRAINING',
  'a one-off practice appears on the shared agenda'
);

insert into issued (kind, id)
select 'summer-boundary', public.create_training_series(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  1::smallint, '00:30'::time, 'Australia/Melbourne', '2026-10-12'::date, '2026-10-12'::date, null,
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1a'
);
insert into issued (kind, id)
select 'winter-boundary', public.create_training_series(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  1::smallint, '00:30'::time, 'Australia/Melbourne', '2026-07-06'::date, '2026-07-06'::date, null,
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1a'
);

select is(
  pg_temp.training_start((select id from issued where kind = 'summer-boundary'), '2026-10-12'),
  '2026-10-11 13:30:00+00'::timestamptz,
  'a Monday 00:30 in daylight time starts on the previous Sunday UTC'
);
select is(
  pg_temp.training_start((select id from issued where kind = 'winter-boundary'), '2026-07-06'),
  '2026-07-05 14:30:00+00'::timestamptz,
  'a Monday 00:30 in standard time starts on the previous Sunday UTC'
);

insert into issued (kind, id)
select 'horizon', public.create_training_series(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  1::smallint, '18:30'::time, 'Australia/Melbourne', '2026-10-12'::date, null, null, null
);
select is(
  pg_temp.series_count((select id from issued where kind = 'horizon')),
  16::bigint,
  'an open weekly series stops at sixteen occurrences'
);

insert into issued (kind, id)
select 'editable', public.create_training_series(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  1::smallint, '18:30'::time, 'Australia/Melbourne', '2026-09-28'::date, '2026-10-19'::date, null, null
);

select lives_ok(
  format(
    'select public.edit_training_occurrence(%L, %L, null, null, null)',
    pg_temp.series_event(
      (select id from issued where kind = 'editable'),
      '2026-10-12 18:30:00+11'
    ),
    '2026-10-12 17:00:00+11'
  ),
  'editing one occurrence detaches it'
);

select lives_ok(
  format(
    'select public.edit_training_series(%L, 1::smallint, %L::time, %L, %L::date)',
    (select id from issued where kind = 'editable'),
    '19:00',
    'Australia/Melbourne',
    '2026-10-19'
  ),
  'a later series edit locks and updates the same series'
);

select is(
  pg_temp.training_start((select id from issued where kind = 'editable'), '2026-09-28'),
  '2026-09-28 18:30:00+10'::timestamptz,
  'a past occurrence stays on its original time'
);
select is(
  pg_temp.training_start(null, '2026-10-12'),
  '2026-10-12 17:00:00+11'::timestamptz,
  'a detached occurrence survives the series edit'
);
select is(
  pg_temp.training_start((select id from issued where kind = 'editable'), '2026-10-19'),
  '2026-10-19 19:00:00+11'::timestamptz,
  'a future attached occurrence follows the series edit'
);

insert into issued (kind, id)
select 'split', public.create_training_series(
  '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
  '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
  1::smallint, '18:30'::time, 'Australia/Melbourne', '2026-09-28'::date, '2026-10-19'::date, 'Court 2', null
);
select lives_ok(
  format(
    'select public.edit_training_following(%L, 1::smallint, %L::time, %L, %L::date)',
    pg_temp.series_event(
      (select id from issued where kind = 'split'),
      '2026-10-12 18:30:00+11'
    ),
    '20:00',
    'Australia/Melbourne',
    '2026-10-19'
  ),
  'editing this and future splits the series'
);
select is(
  pg_temp.training_start((select id from issued where kind = 'split'), '2026-10-05'),
  '2026-10-05 18:30:00+11'::timestamptz,
  'occurrences before the split stay on the original series'
);
select is(
  pg_temp.series_end((select id from issued where kind = 'split')),
  '2026-10-11'::date,
  'the original series ends the day before the split'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1b'); end $$;
select lives_ok(
  format('select public.check_in_training(%L)', (select id from issued where kind = 'once')),
  'an assistant coach can check in once'
);
select is(
  pg_temp.sqlstate_of(format(
    'select public.check_in_training(%L)',
    (select id from issued where kind = 'once')
  )),
  'P0001',
  'a second check-in conflicts'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1c'); end $$;
select is(
  pg_temp.sqlstate_of(format(
    'select public.check_in_training(%L)',
    (select id from issued where kind = 'once')
  )),
  '42501',
  'a team manager cannot check in'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f1e'); end $$;
select is(
  pg_temp.sqlstate_of($sql$
    select public.create_training_session(
      '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
      '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
      '2026-10-21 18:30:00+11',
      null, null, null
    )
  $sql$),
  '42501',
  'an outsider cannot create training'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'training.created'
      and club_id = '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a'
  ),
  1::bigint,
  'failed training authorization does not write an audit row'
);
select ok(
  pg_get_functiondef('public.edit_training_series(uuid,smallint,time,text,date)'::regprocedure)
    ilike '%for update%',
  'series edits lock the series'
);

set local role authenticated;
select throws_ok(
  'select id from public.recurrence_series',
  '42501',
  null,
  'authenticated callers cannot read a training series directly'
);

select * from finish();
rollback;
