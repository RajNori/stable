-- Duty acknowledgement follows current assignment eligibility.

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
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101', 'authenticated', 'authenticated', 'ack-staff@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102', 'authenticated', 'authenticated', 'ack-revoked-staff@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103', 'authenticated', 'authenticated', 'ack-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104', 'authenticated', 'authenticated', 'ack-revoked-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105', 'authenticated', 'authenticated', 'ack-former@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b106', 'authenticated', 'authenticated', 'ack-cross-team@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101', 'Ack Staff', 'Ack', 'Staff'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102', 'Ack Revoked Staff', 'Ack', 'RevokedStaff'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103', 'Ack Guardian', 'Ack', 'Guardian'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104', 'Ack Revoked Guardian', 'Ack', 'RevokedGuardian'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105', 'Ack Former', 'Ack', 'Former'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b106', 'Ack Cross', 'Ack', 'Cross');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'Ack Club', 'ack-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1c1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'Ack Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1c1', 'Ack Team', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1c1', 'Other Ack Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101', 'TEAM_MANAGER', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102', 'TEAM_MANAGER', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105', 'TEAM_MANAGER', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b106', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'Active', 'Child', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'Revoked', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e1', true),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1e2', true);

insert into public.events (id, club_id, team_id, event_type, starts_at, status)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'GAME', '2026-10-10 18:30:00+11', 'SCHEDULED');

insert into public.duties (id, club_id, team_id, event_id, duty_type, label)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'SCORER', 'Score'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'CLOCK', 'Clock'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f3', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'CANTEEN', 'Canteen'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f4', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'OTHER', 'Door'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f5', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'OTHER', 'Bench'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f6', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1d1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'OTHER', 'Table');

insert into public.duty_assignments (duty_id, assigned_user_id, status, assigned_by)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f3', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f4', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f5', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f6', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b106', 'ASSIGNED', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101');

update public.team_memberships
set active = false
where user_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102';

update public.guardian_relationships
set active = false
where user_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104';

update public.duty_assignments
set assigned_user_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'
where duty_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f5';

select no_plan();

do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101'); end $$;
set local role authenticated;

select is(
  public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  2,
  'active staff acknowledges current assignments'
);

select is(
  public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  0,
  'acknowledgement replay is a no-op'
);

reset role;

select is(
  (select count(*)::integer from public.audit_events
    where action = 'duty.acknowledged'
      and club_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1a1'),
  2,
  'replay does not write another acknowledgement audit'
);

do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1')
  $sql$),
  'FORBIDDEN',
  'revoked staff cannot acknowledge'
);

reset role;
do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103'); end $$;
set local role authenticated;

select is(
  public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  1,
  'an active guardian acknowledges a current assignment'
);

reset role;
do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1')
  $sql$),
  'FORBIDDEN',
  'a revoked guardian cannot acknowledge'
);

reset role;
do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b105'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1')
  $sql$),
  'FORBIDDEN',
  'a former assignee cannot acknowledge'
);

reset role;
do $$ begin perform pg_temp.assume_user('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b106'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.acknowledge_own_game_duty('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1')
  $sql$),
  'FORBIDDEN',
  'a cross-team assignee cannot acknowledge'
);

reset role;

select is(
  (select acknowledged_at is null from public.duty_assignments
    where duty_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1f2'),
  true,
  'revoked staff acknowledgement does not stamp the duty'
);

select * from finish();
rollback;
