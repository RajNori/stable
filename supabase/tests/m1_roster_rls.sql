-- Slice 1.6 roster projections. Fixtures are policy users, not a sign-in path.

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
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'authenticated', 'authenticated', 'roster-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'authenticated', 'authenticated', 'roster-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'authenticated', 'authenticated', 'roster-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'authenticated', 'authenticated', 'roster-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', 'authenticated', 'authenticated', 'roster-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e', 'authenticated', 'authenticated', 'roster-revoked-staff@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', 'authenticated', 'authenticated', 'roster-revoked-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'authenticated', 'authenticated', 'roster-other-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f22', 'authenticated', 'authenticated', 'roster-multi@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f23', 'authenticated', 'authenticated', 'roster-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f24', 'authenticated', 'authenticated', 'roster-inactive-link@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'Roster Admin', 'Roster', 'Admin'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'Roster Head', 'Roster', 'Head'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'Roster Assistant', 'Roster', 'Assistant'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'Roster Manager', 'Roster', 'Manager'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', 'Roster Guardian', 'Roster', 'Guardian'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e', 'Roster Revoked', 'Roster', 'Revoked'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', 'Roster Former', 'Roster', 'Former'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'Roster Other', 'Roster', 'Other'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f22', 'Roster Multi', 'Roster', 'Multi'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f23', 'Roster Outsider', 'Roster', 'Outsider'),
  ('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f24', 'Roster Idle', 'Roster', 'Idle');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Roster Club', 'roster-club', 'Australia/Melbourne', 'mustangs'),
  ('2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', 'Roster Other Club', 'roster-other', 'Australia/Melbourne', 'other');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f', 'CLUB_ADMIN', true),
  ('2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Roster Season'),
  ('2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2d', '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', 'Other Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', 'Roster Team', true),
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', 'Roster Other Team', true),
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d20', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2c', 'Roster Inactive', false),
  ('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d21', '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', '2c2c2c2c-2c2c-42c2-82c2-2c2c2c2c2c2d', 'Foreign Team', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Alexander', 'Robertson', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2f', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Mina', 'Kim', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e20', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Idle', 'Park', false),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e21', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Noah', 'Side', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e22', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Morgan', 'Lee', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e23', '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', 'Foreign', 'Kid', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e24', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Quinn', 'Moss', true),
  ('2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25', '2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', 'Casey', 'Ng', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a', 'HEAD_COACH', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b', 'ASSISTANT_COACH', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c', 'TEAM_MANAGER', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e', 'HEAD_COACH', false),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f22', 'HEAD_COACH', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2f', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e20', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e21', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e22', true),
  ('2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d21', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e23', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e24', false);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2f', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20', false),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2f', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f22', true),
  ('2a2a2a2a-2a2a-42a2-82a2-2a2a2a2a2a2a', '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e24', '2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f24', true);

select no_plan();

select ok(
  (
    select proargnames::text
    from pg_proc
    where proname = 'list_team_roster_masked'
  ) = '{p_team_id,player_id,team_id,display_name}',
  'masked roster has no contact or registered-name column'
);
select ok(
  (
    select proargnames::text
    from pg_proc
    where proname = 'list_team_roster_full'
  ) = '{p_team_id,player_id,team_id,registered_name}',
  'full roster has no contact or masked-only column'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1d'); end $$;
set local role authenticated;

select is(
  (
    select display_name
    from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e'
  ),
  'Alexander R.',
  'a guardian sees a masked teammate name'
);
select is(
  (
    select count(*)
    from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
  ),
  2::bigint,
  'a guardian sees only the active players on that team'
);
select ok(
  not exists (
    select 1
    from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where display_name like '%Robertson%'
      or display_name like '%Park%'
      or display_name like '%Side%'
      or display_name like '%Kid%'
  ),
  'a masked roster omits surnames, inactive players, and other teams'
);
select throws_ok(
  $$select * from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'a guardian cannot read the full roster'
);
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e')$$,
  '42501',
  'FORBIDDEN',
  'a guardian cannot read another team'
);
select is(
  (select count(*) from public.players),
  0::bigint,
  'a guardian still cannot read player rows'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1a'); end $$;
select is(
  (
    select registered_name
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e'
  ),
  'Alexander Robertson',
  'a head coach sees the registered name'
);
select is(
  (select count(*) from public.players),
  0::bigint,
  'a head coach still cannot read player rows'
);
select throws_ok(
  $$select public.register_player_on_team(
    '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25',
    '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d'
  )$$,
  'P0002',
  'NOT_FOUND',
  'a head coach cannot register a player'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1b'); end $$;
select is(
  (
    select registered_name
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2f'
  ),
  'Mina Kim',
  'an assistant coach sees the registered name'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1c'); end $$;
select is(
  (
    select registered_name
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e'
  ),
  'Alexander Robertson',
  'a team manager sees the registered name'
);
select throws_ok(
  $$select public.register_player_on_team(
    '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e22',
    '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d'
  )$$,
  '42501',
  'FORBIDDEN',
  'a team manager cannot move a player off another team'
);
select throws_ok(
  $$select public.register_player_on_team(
    '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25',
    '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2e'
  )$$,
  'P0002',
  'NOT_FOUND',
  'a team manager cannot register onto another team'
);
select lives_ok(
  $$select public.register_player_on_team(
    '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25',
    '2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d'
  )$$,
  'a team manager can register onto their team'
);
select lives_ok(
  $$select public.unregister_player_from_team(
    '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25'
  )$$,
  'a team manager can unregister from their team'
);
select ok(
  not exists (
    select 1
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e25'
  ),
  'an unregistered player leaves the roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f2f'); end $$;
select is(
  (
    select registered_name
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e'
  ),
  'Alexander Robertson',
  'a club admin sees the registered name'
);
select throws_ok(
  $$select * from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d21')$$,
  '42501',
  'FORBIDDEN',
  'a club admin cannot read another club roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f22'); end $$;
select is(
  (
    select registered_name
    from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')
    where player_id = '2e2e2e2e-2e2e-42e2-82e2-2e2e2e2e2e2e'
  ),
  'Alexander Robertson',
  'a coach who is also a guardian sees the full roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f1e'); end $$;
select throws_ok(
  $$select * from public.list_team_roster_full('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'revoked staff cannot read the roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f20'); end $$;
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'a revoked guardian cannot read the roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f24'); end $$;
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'an inactive registration does not grant a roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f21'); end $$;
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'another club admin cannot read this roster'
);

do $$ begin perform pg_temp.assume_user('2f2f2f2f-2f2f-42f2-82f2-2f2f2f2f2f23'); end $$;
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$,
  '42501',
  'FORBIDDEN',
  'an outsider cannot read the roster'
);
select throws_ok(
  $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d20')$$,
  '42501',
  'FORBIDDEN',
  'an inactive team denies the roster'
);
select throws_ok(
  $$select * from public.list_team_roster_masked('abababab-abab-4aba-8aba-abababababab')$$,
  'P0002',
  'NOT_FOUND',
  'a missing team is not found'
);

reset role;
set local role anon;
select is(
  pg_temp.sqlstate_of(
    $$select * from public.list_team_roster_masked('2d2d2d2d-2d2d-42d2-82d2-2d2d2d2d2d2d')$$
  ),
  '42501',
  'anon cannot execute the roster'
);

select * from finish();
rollback;
