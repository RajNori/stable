-- Slice 2.1 fixture authorization. Rows are synthetic and roll back.

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
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'authenticated', 'authenticated', 'fixture-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'authenticated', 'authenticated', 'fixture-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'authenticated', 'authenticated', 'fixture-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'authenticated', 'authenticated', 'fixture-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', 'authenticated', 'authenticated', 'fixture-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e', 'authenticated', 'authenticated', 'fixture-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', 'authenticated', 'authenticated', 'fixture-other-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'authenticated', 'authenticated', 'fixture-revoked@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'Fixture Admin', 'Fixture', 'Admin'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'Fixture Head', 'Fixture', 'Head'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'Fixture Assistant', 'Fixture', 'Assistant'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'Fixture Manager', 'Fixture', 'Manager'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', 'Fixture Guardian', 'Fixture', 'Guardian'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e', 'Fixture Outsider', 'Fixture', 'Outsider'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', 'Fixture Other', 'Fixture', 'Other'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'Fixture Revoked', 'Fixture', 'Revoked');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Fixture Club', 'fixture-club', 'Australia/Melbourne', 'mustangs'),
  ('2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', 'Fixture Other', 'fixture-other', 'Australia/Melbourne', 'other');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'CLUB_ADMIN', true),
  ('2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', 'CLUB_ADMIN', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'CLUB_ADMIN', false);

insert into public.seasons (id, club_id, name)
values
  ('2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Fixture Season'),
  ('2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2d', '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', 'Other Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', 'Fixture Team', true),
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', 'Fixture Inactive', false),
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d20', '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2d', 'Other Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'HEAD_COACH', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'ASSISTANT_COACH', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Synthetic', 'Player', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', true);

select no_plan();

select has_table('public', 'events', 'events exists');
select has_table('public', 'games', 'games exists');
select has_table('public', 'game_team_overlay', 'overlay exists');
select has_table('public', 'playhq_mappings', 'mappings exist without a sync client');
select is(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.events'::regclass),
  true,
  'events forces row level security'
);

insert into public.events (
  club_id, team_id, event_type, starts_at, status
)
values (
  '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
  '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
  'TRAINING',
  '2026-10-11 09:00:00+11',
  'SCHEDULED'
);
select is(
  (select event_type from public.events where event_type = 'TRAINING'),
  'TRAINING',
  'the shared event type allows training before a training write exists'
);
delete from public.events where event_type = 'TRAINING';

set local role authenticated;
select is(
  pg_temp.sqlstate_of($$select * from public.events$$),
  '42501',
  'authenticated cannot select events'
);
select is(
  pg_temp.sqlstate_of($$select * from public.games$$),
  '42501',
  'authenticated cannot select games'
);
select is(
  pg_temp.sqlstate_of($$select * from public.game_team_overlay$$),
  '42501',
  'authenticated cannot select overlay'
);
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'UNAUTHENTICATED',
  'a signed-out caller cannot create a fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'a head coach cannot create an official fixture'
);
reset role;
select is(
  (select count(*) from public.audit_events where action = 'fixture.created'),
  0::bigint,
  'a denied official write does not audit'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'an assistant coach cannot create an official fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'a guardian cannot create an official fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'an outsider cannot create an official fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'another club admin cannot create a fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'a revoked club admin cannot create a fixture'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      'Visitors',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'FORBIDDEN',
  'an inactive team denies fixture writes'
);
select is(
  pg_temp.sqlerrm_of($$
    select public.create_manual_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 18:30:00+11',
      null, null, null, null, null,
      ' ',
      '2026-10-10 18:30:00+11',
      null, null, null
    )
  $$),
  'VALIDATION_FAILED',
  'a blank opponent fails validation'
);
reset role;

create temp table issued_fixtures (
  label text primary key,
  event_id uuid not null
);
grant all on table issued_fixtures to authenticated;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c'); end $$;
set local role authenticated;

insert into issued_fixtures (label, event_id)
select 'early', public.create_manual_fixture(
  '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
  '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
  '2026-10-10 18:30:00+11',
  '2026-10-10 20:00:00+11',
  null,
  'Court 1',
  null,
  'Round 1',
  ' Visitors ',
  '2026-10-10 18:30:00+11',
  ' Home ',
  ' Court 1 ',
  'HOME'
);

insert into issued_fixtures (label, event_id)
select 'late', public.create_manual_fixture(
  '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
  '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
  '2026-10-12 18:30:00+11',
  null, null, null, null, null,
  'Later',
  '2026-10-12 18:30:00+11',
  null, null, null
);

insert into issued_fixtures (label, event_id)
select 'imported', public.import_fixture(
  '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
  '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
  '2026-10-17 18:30:00+11',
  null, null, null, null, 'Round 2',
  'Imported',
  '2026-10-17 18:30:00+11',
  null, null, 'HOME',
  'ext-game-1'
);

select is(
  pg_temp.sqlerrm_of($$
    select public.import_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-18 18:30:00+11',
      null, null, null, null, null,
      'Again',
      '2026-10-18 18:30:00+11',
      null, null, null,
      'ext-game-1'
    )
  $$),
  'CONFLICT',
  'the same external fixture cannot be imported twice'
);
reset role;

select is(
  (select source from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  'MANUAL',
  'a manual fixture is tagged MANUAL'
);
select is(
  (select external_id from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  null,
  'a manual fixture has no external id'
);
select is(
  (select opponent_name from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  'Visitors',
  'official opponent text is trimmed'
);
select is(
  (select arrival_at from public.game_team_overlay where game_event_id = (select event_id from issued_fixtures where label = 'early')),
  null,
  'overlay starts empty'
);
select is(
  (
    select action || ':' || actor_user_id::text || ':' || club_id::text || ':' || target_id::text
    from public.audit_events
    where action = 'fixture.created'
      and target_id = (select event_id from issued_fixtures where label = 'early')
  ),
  'fixture.created:2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c:2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a:' || (select event_id::text from issued_fixtures where label = 'early'),
  'fixture creation audits actor, action, club, and target only'
);
select is_empty(
  $$
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_events'
      and column_name in ('opponent_name', 'token', 'private_note', 'uniform_note')
  $$,
  'audit storage has no fixture or child payload'
);
select is(
  (select source from public.games where event_id = (select event_id from issued_fixtures where label = 'imported')),
  'IMPORT',
  'an import is tagged IMPORT'
);
select is(
  (
    select external_id
    from public.playhq_mappings
    where internal_id = (select event_id from issued_fixtures where label = 'imported')
  ),
  'ext-game-1',
  'an import stores a local mapping and does not call a provider'
);
select is(
  (select action from public.audit_events where target_id = (select event_id from issued_fixtures where label = 'imported')),
  'fixture.imported',
  'an import audits fixture.imported'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of(
    format(
      $$select public.update_fixture_overlay(%L, '2026-10-10 17:00:00+11', 'White', null, null)$$,
      (select event_id from issued_fixtures where label = 'early')
    )
  ),
  'FORBIDDEN',
  'an assistant coach cannot update the overlay'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a'); end $$;
set local role authenticated;
select lives_ok(
  format(
    $$select public.update_fixture_overlay(%L, '2026-10-10 17:00:00+11', ' White ', 'Press', null)$$,
    (select event_id from issued_fixtures where label = 'early')
  ),
  'a head coach can update the overlay'
);
reset role;

select is(
  (select opponent_name from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  'Visitors',
  'an overlay update does not change the opponent'
);
select is(
  (select uniform_note from public.game_team_overlay where game_event_id = (select event_id from issued_fixtures where label = 'early')),
  'White',
  'an overlay update stores the team uniform'
);
select is(
  (select action from public.audit_events where action = 'fixture.overlay_updated' and target_id = (select event_id from issued_fixtures where label = 'early')),
  'fixture.overlay_updated',
  'an overlay update is audited'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of(
    format(
      $$select public.update_official_fixture(
        '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
        '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
        '2026-10-10 19:00:00+11',
        null, null, null, null, 'Round 1',
        'Changed',
        '2026-10-10 19:00:00+11',
        null, null, 'HOME',
        %L,
        'POSTPONED',
        null, null, null
      )$$,
      (select event_id from issued_fixtures where label = 'early')
    )
  ),
  'FORBIDDEN',
  'a head coach cannot update official fixture fields'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c'); end $$;
set local role authenticated;
select lives_ok(
  format(
    $$select public.update_official_fixture(
      '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a',
      '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d',
      '2026-10-10 19:00:00+11',
      null, null, null, null, 'Round 1',
      'Changed',
      '2026-10-10 19:00:00+11',
      null, null, 'AWAY',
      %L,
      'POSTPONED',
      12, 8, 'FINAL'
    )$$,
    (select event_id from issued_fixtures where label = 'early')
  ),
  'a team manager can update official fixture fields'
);
reset role;

select is(
  (select opponent_name from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  'Changed',
  'an official update changes the opponent'
);
select is(
  (select uniform_note from public.game_team_overlay where game_event_id = (select event_id from issued_fixtures where label = 'early')),
  'White',
  'an official update does not change the overlay'
);
select is(
  (select team_score from public.games where event_id = (select event_id from issued_fixtures where label = 'early')),
  12,
  'scores stay on the official game row'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d'); end $$;
set local role authenticated;
select is(
  (
    select opponent_name
    from public.list_team_fixtures('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    order by starts_at
    limit 1
  ),
  'Changed',
  'a guardian can read the team fixtures in start order'
);
select is(
  pg_temp.sqlerrm_of($$select public.list_team_fixtures('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d20')$$),
  'FORBIDDEN',
  'a guardian cannot read another club team'
);
reset role;

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of($$select public.list_team_fixtures('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$),
  'FORBIDDEN',
  'an outsider cannot read fixtures'
);
reset role;

select * from finish();

rollback;
