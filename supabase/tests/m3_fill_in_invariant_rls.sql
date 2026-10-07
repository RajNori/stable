-- One confirmed fill-in per event, including a real two-session race.

begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

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

create or replace function pg_temp.fresh_game(opponent text, starts timestamptz)
returns uuid
language plpgsql
as $$
begin
  return public.create_manual_fixture(
    '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
    '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
    starts,
    null, null, null, null, 'Round 1',
    opponent,
    starts,
    'Invariant Venue', 'Court A', 'HOME'
  );
end;
$$;

create or replace function pg_temp.db_link()
returns text
language sql
as $$
  select format(
    'host=%s port=5432 dbname=postgres user=postgres password=postgres',
    host(inet_server_addr())
  );
$$;

create or replace function pg_temp.remote_text(conn text)
returns text
language plpgsql
as $$
declare
  result text;
begin
  select id::text
  into result
  from extensions.dblink_get_result(conn) as remote(id uuid);
  return coalesce(result, 'EMPTY');
exception
  when others then
    return sqlerrm;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'authenticated', 'authenticated', 'invariant-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', 'authenticated', 'authenticated', 'invariant-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'Invariant Manager', 'Invariant', 'Manager'),
  ('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', 'Invariant Guardian', 'Invariant', 'Guardian');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Invariant Club', 'invariant-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Invariant Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c', 'Invariant Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Ada', 'Child', true),
  ('6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02', '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', 'Bea', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', true),
  ('6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a', '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02', '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03', true);

select no_plan();

create temp table game_ids (
  label text primary key,
  event_id uuid not null,
  first_request uuid,
  second_request uuid
);
grant all on table game_ids to authenticated;

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'sequential', pg_temp.fresh_game('Sequential Opponent', '2026-10-10 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'sequential';

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'sequential'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select public.confirm_fill_in(
  (select first_request from game_ids where label = 'sequential'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.request_fill_in(
      (select event_id from game_ids where label = 'sequential')
    )
  $sql$),
  'CONFLICT',
  'a second fill-in request is denied after confirmation'
);

select is(
  (select fill_in_label from public.read_game_day(
    (select event_id from game_ids where label = 'sequential')
  )),
  'Ada C.',
  'game day shows the one confirmed fill-in'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_confirmations
    where event_id = (select event_id from game_ids where label = 'sequential')),
  1,
  'the sequential game has one confirmation row'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'pair', pg_temp.fresh_game('Pair Opponent', '2026-10-17 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'pair';

update game_ids
set second_request = public.request_fill_in(event_id)
where label = 'pair';

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'pair'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);
select public.respond_fill_in(
  (select second_request from game_ids where label = 'pair'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select public.confirm_fill_in(
  (select first_request from game_ids where label = 'pair'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select second_request from game_ids where label = 'pair'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02'
    )
  $sql$),
  'CONFLICT',
  'a second confirmation for the same game is denied'
);

select is(
  public.enqueue_fill_in_confirmed(
    (select first_request from game_ids where label = 'pair')
  ),
  1,
  'only the winning confirmation enqueues a notification'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.enqueue_fill_in_confirmed(
      (select second_request from game_ids where label = 'pair')
    )
  $sql$),
  'FORBIDDEN',
  'the losing request cannot enqueue a confirmation notification'
);

reset role;

select is(
  (select count(*)::integer from public.audit_events
    where action = 'fill_in.confirmed'
      and target_id in (
        select id from public.fill_in_confirmations
        where event_id = (select event_id from game_ids where label = 'pair')
      )),
  1,
  'only the winning confirmation is audited'
);

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'FILL_IN_CONFIRMED'
      and source_id = (select first_request from game_ids where label = 'pair')),
  1,
  'the winner has one confirmation notification'
);

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'FILL_IN_CONFIRMED'
      and source_id = (select second_request from game_ids where label = 'pair')),
  0,
  'the loser has no confirmation notification'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'cancel-response', pg_temp.fresh_game('Cancel Response', '2026-10-24 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'cancel-response';

reset role;

update public.events
set status = 'CANCELLED'
where id = (select event_id from game_ids where label = 'cancel-response');

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.respond_fill_in(
      (select first_request from game_ids where label = 'cancel-response'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'CONFLICT',
  'a cancelled game cannot receive a fill-in response'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_responses
    where request_id = (select first_request from game_ids where label = 'cancel-response')),
  0,
  'a cancelled game stores no fill-in response'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'cancel-confirm', pg_temp.fresh_game('Cancel Confirm', '2026-10-31 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'cancel-confirm';

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'cancel-confirm'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);

reset role;

update public.events
set status = 'CANCELLED'
where id = (select event_id from game_ids where label = 'cancel-confirm');

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select first_request from game_ids where label = 'cancel-confirm'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'CONFLICT',
  'a cancelled game cannot be confirmed'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.enqueue_fill_in_confirmed(
      (select first_request from game_ids where label = 'cancel-confirm')
    )
  $sql$),
  'FORBIDDEN',
  'a cancelled game enqueues no confirmation notification'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_confirmations
    where event_id = (select event_id from game_ids where label = 'cancel-confirm')),
  0,
  'a cancelled game stores no confirmation'
);

select is(
  (select count(*)::integer from public.audit_events
    where action = 'fill_in.confirmed'
      and club_id = '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a'
      and target_id not in (
        select id from public.fill_in_confirmations
        where event_id in (
          select event_id from game_ids where label in ('sequential', 'pair')
        )
      )),
  0,
  'a cancelled confirmation writes no audit row'
);

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'training', pg_temp.fresh_game('Training Opponent', '2026-11-07 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'training';

reset role;

update public.events
set event_type = 'TRAINING'
where id = (select event_id from game_ids where label = 'training');

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.respond_fill_in(
      (select first_request from game_ids where label = 'training'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'CONFLICT',
  'a non-game event cannot receive a fill-in response'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'inactive-team', pg_temp.fresh_game('Inactive Opponent', '2026-11-14 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'inactive-team';

reset role;

update public.teams
set active = false
where id = '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d';

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.respond_fill_in(
      (select first_request from game_ids where label = 'inactive-team'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'CONFLICT',
  'an inactive team cannot receive a fill-in response'
);

reset role;

update public.teams
set active = true
where id = '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d';

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'missing-game', pg_temp.fresh_game('Missing Opponent', '2026-11-21 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'missing-game';

reset role;

delete from public.game_team_overlay
where game_event_id = (select event_id from game_ids where label = 'missing-game');

delete from public.games
where event_id = (select event_id from game_ids where label = 'missing-game');

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select first_request from game_ids where label = 'missing-game'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'CONFLICT',
  'a game without a fixture row cannot be confirmed'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'stale-consent', pg_temp.fresh_game('Stale Opponent', '2026-11-28 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'stale-consent';

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'stale-consent'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
);

reset role;

update public.guardian_relationships
set active = false
where user_id = '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'
  and player_id = '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01';

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.confirm_fill_in(
      (select first_request from game_ids where label = 'stale-consent'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01'
    )
  $sql$),
  'VALIDATION_FAILED',
  'a revoked guardian cannot supply confirmation consent'
);

reset role;

select is(
  (select count(*)::integer from public.fill_in_responses
    where request_id = (select first_request from game_ids where label = 'stale-consent')),
  1,
  'the historical response stays after consent is revoked'
);

select is(
  (select count(*)::integer from public.fill_in_confirmations
    where event_id = (select event_id from game_ids where label = 'stale-consent')),
  0,
  'revoked consent stores no confirmation'
);

update public.guardian_relationships
set active = true
where user_id = '6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'
  and player_id = '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e01';

do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'current-consent', pg_temp.fresh_game('Current Opponent', '2026-12-05 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'current-consent';

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f03'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'current-consent'),
  '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02'
);

reset role;
do $$ begin perform pg_temp.assume_user('6f6f6f6f-6f6f-46f6-86f6-6f6f6f6f6f01'); end $$;
set local role authenticated;

select lives_ok(
  $sql$
    select public.confirm_fill_in(
      (select first_request from game_ids where label = 'current-consent'),
      '6e6e6e6e-6e6e-46e6-86e6-6e6e6e6e6e02'
    )
  $sql$,
  'an active guardian response can still be confirmed'
);

reset role;

select extensions.dblink_connect('race_setup', pg_temp.db_link());

select extensions.dblink_exec(
  'race_setup',
  $setup$
    delete from public.notification_deliveries
    where request_id in (
      select id from public.notification_requests
      where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711'
    );
    delete from public.notification_requests
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.audit_events
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.fill_in_confirmations
    where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.fill_in_responses
    where request_id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a741',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a742'
    );
    delete from public.fill_in_requests
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.game_team_overlay
    where game_event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.games
    where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.events
    where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.guardian_relationships
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.player_team_registrations
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.team_memberships
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.players
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.teams
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.seasons
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.clubs
    where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.profiles
    where user_id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724'
    );
    delete from auth.users
    where id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724'
    );
  $setup$
);

select extensions.dblink_exec(
  'race_setup',
  $setup$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    values
      ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', 'authenticated', 'authenticated', 'race-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
      ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722', 'authenticated', 'authenticated', 'race-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
      ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723', 'authenticated', 'authenticated', 'race-guardian-a@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
      ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724', 'authenticated', 'authenticated', 'race-guardian-b@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

    insert into public.profiles (user_id, display_name, first_name, last_name)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', 'Race Manager', 'Race', 'Manager'),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722', 'Race Coach', 'Race', 'Coach'),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723', 'Race Guardian A', 'Race', 'GuardianA'),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724', 'Race Guardian B', 'Race', 'GuardianB');

    insert into public.clubs (id, name, slug, timezone, theme_key)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'Race Club', 'race-club', 'Australia/Melbourne', 'mustangs');

    insert into public.seasons (id, club_id, name)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a712', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'Race Season');

    insert into public.teams (id, club_id, season_id, name, active)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a712', 'Race Team', true);

    insert into public.team_memberships (club_id, team_id, user_id, role, active)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', 'TEAM_MANAGER', true),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722', 'HEAD_COACH', true);

    insert into public.players (id, club_id, first_name, last_name, active)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a731', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'Ada', 'Child', true),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a732', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'Bea', 'Child', true);

    insert into public.guardian_relationships (club_id, player_id, user_id, active)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a731', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723', true),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a732', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724', true);

    insert into public.events (id, club_id, team_id, event_type, starts_at, status)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'GAME', '2026-12-12 18:30:00+11', 'SCHEDULED');

    insert into public.games (
      event_id, club_id, opponent_name, source, official_start_at, fixture_status
    )
    values (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711',
      'Race Opponent',
      'MANUAL',
      '2026-12-12 18:30:00+11',
      'SCHEDULED'
    );

    insert into public.fill_in_requests (
      id, club_id, team_id, event_id, requested_by, status
    )
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a741', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', 'OPEN'),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a742', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', 'OPEN');

    insert into public.fill_in_responses (request_id, player_id, guardian_user_id)
    values
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a741', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a731', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723'),
      ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a742', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a732', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724');
  $setup$
);

select extensions.dblink_connect('race_a', pg_temp.db_link());
select extensions.dblink_connect('race_b', pg_temp.db_link());

select extensions.dblink_exec(
  'race_a',
  $setup$
    do $body$
    begin
      perform set_config('request.jwt.claim.sub', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721', false);
      perform set_config('request.jwt.claim.role', 'authenticated', false);
      perform set_config(
        'request.jwt.claims',
        '{"sub":"a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721","role":"authenticated"}',
        false
      );
      execute 'set role authenticated';
      execute 'set lock_timeout = ''5s''';
    end
    $body$;
  $setup$
);

select extensions.dblink_exec(
  'race_b',
  $setup$
    do $body$
    begin
      perform set_config('request.jwt.claim.sub', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722', false);
      perform set_config('request.jwt.claim.role', 'authenticated', false);
      perform set_config(
        'request.jwt.claims',
        '{"sub":"a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722","role":"authenticated"}',
        false
      );
      execute 'set role authenticated';
      execute 'set lock_timeout = ''5s''';
    end
    $body$;
  $setup$
);

select extensions.dblink_send_query(
  'race_a',
  $setup$
    select public.confirm_fill_in(
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a741',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a731'
    )
  $setup$
);

select extensions.dblink_send_query(
  'race_b',
  $setup$
    select public.confirm_fill_in(
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a742',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a732'
    )
  $setup$
);

create temp table race_results (
  slot text primary key,
  result text not null
);

insert into race_results (slot, result)
values
  ('a', pg_temp.remote_text('race_a')),
  ('b', pg_temp.remote_text('race_b'));

select is(
  (
    (select (result ~ '^[0-9a-f-]{36}$')::integer from race_results where slot = 'a')
    + (select (result ~ '^[0-9a-f-]{36}$')::integer from race_results where slot = 'b')
  ),
  1,
  'exactly one concurrent confirmation succeeds'
);

select ok(
  coalesce(
    (
      select bool_and(result = 'CONFLICT' or result like '%CONFLICT')
      from race_results
      where result !~ '^[0-9a-f-]{36}$'
    ),
    false
  ),
  'the losing concurrent confirmation is denied'
);

select is(
  (select count(*)::integer from public.fill_in_confirmations
    where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714'),
  1,
  'the race leaves one confirmation'
);

select is(
  (select count(*)::integer from public.audit_events
    where action = 'fill_in.confirmed'
      and club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711'),
  1,
  'the race writes one confirmation audit'
);

select extensions.dblink_exec(
  'race_setup',
  format(
    $setup$
      do $body$
      begin
        perform set_config('request.jwt.claim.sub', %L, false);
        perform set_config('request.jwt.claim.role', 'authenticated', false);
        perform set_config('request.jwt.claims', %L, false);
        execute 'set role authenticated';
        perform public.enqueue_fill_in_confirmed(%L::uuid);
      end
      $body$;
    $setup$,
    (select confirmed_by::text from public.fill_in_confirmations
      where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714'),
    (select json_build_object(
      'sub', confirmed_by::text,
      'role', 'authenticated'
    )::text from public.fill_in_confirmations
      where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714'),
    (select request_id::text from public.fill_in_confirmations
      where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714')
  )
);

select is(
  (select count(*)::integer from public.notification_requests
    where notification_type = 'FILL_IN_CONFIRMED'
      and team_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a713'),
  1,
  'the race enqueues one confirmation notification'
);

select extensions.dblink_disconnect('race_a');
select extensions.dblink_disconnect('race_b');
select extensions.dblink_disconnect('race_setup');

select extensions.dblink_connect('race_cleanup', pg_temp.db_link());
select extensions.dblink_exec(
  'race_cleanup',
  $setup$
    delete from public.notification_deliveries
    where request_id in (
      select id from public.notification_requests
      where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711'
    );
    delete from public.notification_requests
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.audit_events
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.fill_in_confirmations
    where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.fill_in_responses
    where request_id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a741',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a742'
    );
    delete from public.fill_in_requests
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.games
    where event_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.events
    where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a714';
    delete from public.guardian_relationships
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.team_memberships
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.players
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.teams
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.seasons
    where club_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.clubs
    where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a711';
    delete from public.profiles
    where user_id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724'
    );
    delete from auth.users
    where id in (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a721',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a722',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a723',
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a724'
    );
  $setup$
);
select extensions.dblink_disconnect('race_cleanup');

select * from finish();
rollback;
