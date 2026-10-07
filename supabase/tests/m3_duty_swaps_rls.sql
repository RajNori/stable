-- Slice 3.4 duty swaps. One winner, a targeted request, and a cancel.

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
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'authenticated', 'authenticated', 'swap-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02', 'authenticated', 'authenticated', 'swap-guardian-a@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', 'authenticated', 'authenticated', 'swap-guardian-b@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'Swap Manager', 'Swap', 'Manager'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02', 'Swap Guardian A', 'Swap', 'A'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', 'Swap Guardian B', 'Swap', 'B');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Swap Club', 'swap-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Swap Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', 'Swap Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Own', 'Child', true),
  ('6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Other', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02', true),
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01', true),
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02', true);

insert into public.events (id, club_id, team_id, event_type, starts_at, status)
values
  ('6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b01', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', 'GAME', '2026-10-10 18:30:00+11', 'SCHEDULED');

select no_plan();

create temp table issued_swap (request_id uuid);
create temp table targeted_swap (request_id uuid);
grant all on table issued_swap to authenticated;
grant all on table targeted_swap to authenticated;

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select public.assign_game_duty(
  '6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b01',
  'CANTEEN',
  'Canteen',
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02'); end $$;
set local role authenticated;

insert into issued_swap (request_id)
select public.request_duty_swap('6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b01', null);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select lives_ok(
  $sql$select public.accept_duty_swap((select request_id from issued_swap))$sql$,
  'the first eligible adult accepts'
);

select is(
  public.enqueue_duty_swap_accepted((select request_id from issued_swap)),
  1,
  'acceptance enqueues one notification'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.accept_duty_swap((select request_id from issued_swap))
  $sql$),
  'CONFLICT',
  'a second accepter loses'
);

reset role;

select is(
  (select assignment.assigned_user_id::text
    from public.duty_assignments as assignment
    join public.duties as duty on duty.id = assignment.duty_id
    where duty.label = 'Canteen'),
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03',
  'the winner owns the swapped duty'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select public.assign_game_duty(
  '6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b01',
  'CLOCK',
  'Clock',
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02'
);

reset role;

select ok(
  (select payload::text not like '%Child%' from public.notification_requests limit 1),
  'the swap payload has no child name'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02'); end $$;
set local role authenticated;

insert into targeted_swap (request_id)
select public.request_duty_swap(
  '6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b01',
  '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.accept_duty_swap((select request_id from targeted_swap))
  $sql$),
  'FORBIDDEN',
  'a third adult cannot accept a targeted request'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f02'); end $$;
set local role authenticated;

select lives_ok(
  $sql$
    select public.cancel_duty_swap((select request_id from targeted_swap))
  $sql$,
  'the requester cancels an open request'
);

select * from finish();
rollback;
