-- Team Manager Home operational counts are aggregate-only and exact-team scoped.

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
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10001', 'authenticated', 'authenticated', 'home-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', 'authenticated', 'authenticated', 'home-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10003', 'authenticated', 'authenticated', 'home-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10004', 'authenticated', 'authenticated', 'home-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005', 'authenticated', 'authenticated', 'home-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10006', 'authenticated', 'authenticated', 'home-other-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10001', 'Home Admin', 'Home', 'Admin'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', 'Home Manager', 'Home', 'Manager'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10003', 'Home Coach', 'Home', 'Coach'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10004', 'Home Assistant', 'Home', 'Assistant'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005', 'Home Guardian', 'Home', 'Guardian'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10006', 'Other Manager', 'Other', 'Manager');

insert into public.clubs (id, name, slug, timezone, theme_key)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'Home Summary Club', 'home-summary-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10001', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10201', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'Home Summary Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10201', 'Home Summary Team', true),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10302', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10201', 'Other Summary Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', 'TEAM_MANAGER', true),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10003', 'HEAD_COACH', true),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10004', 'ASSISTANT_COACH', true),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10302', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10006', 'TEAM_MANAGER', true);

insert into public.events (id, club_id, team_id, event_type, starts_at, status)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'GAME', '2026-10-25 18:30:00+11', 'SCHEDULED');

insert into public.duties (id, club_id, team_id, event_id, duty_type, label)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10501', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'SCORER', 'Score'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10502', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'CLOCK', 'Clock'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10503', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'OTHER', 'Door');

insert into public.duty_assignments (id, duty_id, assigned_user_id, status, assigned_by, acknowledged_at)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10601', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10501', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005', 'ASSIGNED', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', '2026-10-10 10:00:00+11'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10602', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10502', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005', 'ASSIGNED', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', null);

insert into public.duty_swap_requests (id, club_id, team_id, assignment_id, requester_user_id, status)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10701', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10602', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005', 'OPEN');

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10801', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'Synthetic', 'One', true),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10802', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'Synthetic', 'Two', true);

insert into public.fill_in_requests (id, club_id, team_id, event_id, requested_by, status)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10901', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', 'OPEN'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10902', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10101', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10301', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002', 'CONFIRMED');

insert into public.fill_in_responses (request_id, player_id, guardian_user_id)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10901', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10801', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005');

insert into public.fill_in_confirmations (request_id, event_id, player_id, confirmed_by)
values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10902', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10802', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002');

select no_plan();

do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10002'); end $$;
set local role authenticated;

select is((select unassigned_duty_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees the count of unassigned duties');
select is((select assigned_duty_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 2, 'manager sees the count of assigned duties');
select is((select acknowledged_duty_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees the aggregate acknowledgement count');
select is((select pending_duty_acknowledgement_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees pending acknowledgement count');
select is((select open_duty_swap_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees open swap count');
select is((select open_fill_in_request_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees open fill-in request count');
select is((select open_fill_in_response_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees response count on open fill-in requests');
select is((select confirmed_fill_in_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 1, 'manager sees confirmed fill-in count');

reset role;
do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10001'); end $$;
set local role authenticated;
select is((select assigned_duty_count from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401')), 2, 'Club Admin can read the existing team operations projection');

reset role;
do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10003'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($sql$ select * from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401') $sql$), 'FORBIDDEN', 'Head Coach cannot read the Manager operations summary');

reset role;
do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10004'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($sql$ select * from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401') $sql$), 'FORBIDDEN', 'Assistant Coach cannot read the Manager operations summary');

reset role;
do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10005'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($sql$ select * from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401') $sql$), 'FORBIDDEN', 'Guardian cannot read the Manager operations summary');

reset role;
do $$ begin perform pg_temp.assume_user('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10006'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($sql$ select * from public.read_team_manager_game_day_operations('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e10401') $sql$), 'FORBIDDEN', 'other-team Manager cannot read this event summary');

reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.read_team_manager_game_day_operations(uuid)',
    'EXECUTE'
  ),
  'anonymous caller has no execute privilege for the operations summary'
);

select * from finish();
rollback;
