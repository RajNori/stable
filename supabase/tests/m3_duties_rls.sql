-- Slice 3.3 duties. Fair allocation and one acknowledgement.

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
  ('00000000-0000-0000-0000-000000000000', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01', 'authenticated', 'authenticated', 'duty-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02', 'authenticated', 'authenticated', 'duty-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03', 'authenticated', 'authenticated', 'duty-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01', 'Duty Manager', 'Duty', 'Manager'),
  ('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02', 'Duty Guardian', 'Duty', 'Guardian'),
  ('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03', 'Duty Head', 'Duty', 'Head');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', 'Duty Club', 'duty-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('9c9c9c9c-9c9c-49c9-89c9-9c9c9c9c9c9c', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', 'Duty Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9c9c9c9c-9c9c-49c9-89c9-9c9c9c9c9c9c', 'Duty Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01', 'TEAM_MANAGER', true),
  ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03', 'HEAD_COACH', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('9e9e9e9e-9e9e-49e9-89e9-9e9e9e9e9e01', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', 'Own', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9e9e9e9e-9e9e-49e9-89e9-9e9e9e9e9e01', '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9e9e9e9e-9e9e-49e9-89e9-9e9e9e9e9e01', true);

insert into public.events (id, club_id, team_id, event_type, starts_at, status)
values
  ('9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', 'GAME', '2026-10-10 18:30:00+11', 'SCHEDULED');

insert into public.duties (id, club_id, team_id, event_id, duty_type, label)
values
  ('9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d01', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01', 'SCORER', 'Score'),
  ('9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d02', '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a', '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d', '9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01', 'CLOCK', 'Clock');

select no_plan();

do $$ begin perform pg_temp.assume_user('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.create_open_game_duty(
      '9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01', 'CANTEEN', 'Canteen'
    )
  $sql$),
  'FORBIDDEN',
  'a head coach cannot allocate duties'
);

reset role;
do $$ begin perform pg_temp.assume_user('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01'); end $$;
set local role authenticated;

select is(
  public.duty_allocation_fingerprint('9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01'),
  '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d01:9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01:0|9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d02:9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02:0',
  'equal counts break by user id and the next duty rotates'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.commit_duty_allocation(
      '9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01',
      'stale'
    )
  $sql$),
  'CONFLICT',
  'a stale fingerprint is rejected'
);

select lives_ok(
  $sql$
    select public.commit_duty_allocation(
      '9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01',
      '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d01:9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f01:0|9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d02:9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02:0'
    )
  $sql$,
  'the current fingerprint assigns both duties'
);

reset role;

select is(
  (select count(*) from public.audit_events where action = 'duty.allocated'),
  1::bigint,
  'allocation writes one audit row'
);

select is(
  (select assigned_user_id::text from public.duty_assignments
    where duty_id = '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d02'),
  '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02',
  'the second duty goes to the other adult'
);

do $$ begin perform pg_temp.assume_user('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f02'); end $$;
set local role authenticated;

select is(
  public.acknowledge_own_game_duty('9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01'),
  1,
  'the assignee acknowledges once'
);
select is(
  public.acknowledge_own_game_duty('9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01'),
  0,
  'acknowledgement replay is a no-op'
);

reset role;

select is(
  (select count(*) from public.audit_events where action = 'duty.acknowledged'),
  1::bigint,
  'a second acknowledgement does not audit again'
);

do $$ begin perform pg_temp.assume_user('9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.acknowledge_own_game_duty('9b9b9b9b-9b9b-49b9-89b9-9b9b9b9b9b01')
  $sql$),
  'FORBIDDEN',
  'another adult cannot acknowledge the assignment'
);

select * from finish();
rollback;
