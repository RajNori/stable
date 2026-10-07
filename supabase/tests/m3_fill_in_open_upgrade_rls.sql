-- Upgrade path for databases that already applied the earlier one-confirmation
-- migration. Duplicate open requests must stop the forward migration.

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

create or replace function pg_temp.fresh_game(opponent text, starts timestamptz)
returns uuid
language plpgsql
as $$
begin
  return public.create_manual_fixture(
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4',
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e412',
    starts,
    null, null, null, null, 'Round 1',
    opponent,
    starts,
    'Upgrade Venue', 'Court A', 'HOME'
  );
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401', 'authenticated', 'authenticated', 'upgrade-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e402', 'authenticated', 'authenticated', 'upgrade-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401', 'Upgrade Manager', 'Upgrade', 'Manager'),
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e402', 'Upgrade Guardian', 'Upgrade', 'Guardian');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'Upgrade Club', 'upgrade-club', 'Australia/Melbourne', 'mustangs');

insert into public.seasons (id, club_id, name)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e411', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'Upgrade Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e412', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e411', 'Upgrade Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e412', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e421', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'Ada', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e421', 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e402', true);

select no_plan();

create temp table game_ids (
  label text primary key,
  event_id uuid not null,
  first_request uuid,
  second_request uuid
);
grant all on table game_ids to authenticated;

-- Earlier 20261007220000 dropped the open index. This state has no duplicate
-- OPEN rows, so the forward migration may restore the invariant.
drop index public.fill_in_requests_one_open;

select lives_ok(
  'select public.restore_fill_in_open_request_invariant()',
  'a database without duplicate open requests accepts the forward upgrade'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_requests_one_open'
  ),
  'the forward upgrade restores one open fill-in request per event'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_confirmations_one_event'
  )
  and exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_requests_one_confirmed'
  ),
  'the one-confirmation invariant remains beside the open-request invariant'
);

select ok(
  pg_get_functiondef('public.request_fill_in(uuid)'::regprocedure)
    like '%status in (''OPEN'', ''CONFIRMED'')%',
  'the forward upgrade installed the corrected request_fill_in'
);

do $$ begin perform pg_temp.assume_user('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'upgrade-open', pg_temp.fresh_game('Upgrade Open', '2026-11-14 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'upgrade-open';

select is(
  pg_temp.sqlerrm_of($sql$
    select public.request_fill_in(
      (select event_id from game_ids where label = 'upgrade-open')
    )
  $sql$),
  'CONFLICT',
  'the upgraded request function denies a second open request'
);

reset role;

update public.fill_in_requests
set status = 'WITHDRAWN'
where id = (select first_request from game_ids where label = 'upgrade-open');

do $$ begin perform pg_temp.assume_user('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401'); end $$;
set local role authenticated;

update game_ids
set second_request = public.request_fill_in(event_id)
where label = 'upgrade-open';

select ok(
  (select second_request from game_ids where label = 'upgrade-open') is not null,
  'a withdrawn request still allows a new request after the upgrade'
);

insert into game_ids (label, event_id)
select 'upgrade-confirmed', pg_temp.fresh_game('Upgrade Confirmed', '2026-11-21 18:30:00+11');

update game_ids
set first_request = public.request_fill_in(event_id)
where label = 'upgrade-confirmed';

select is(
  public.enqueue_fill_in_requested(
    (select first_request from game_ids where label = 'upgrade-confirmed')
  ),
  1,
  'the upgraded schema still enqueues an open fill-in request notice'
);

reset role;
do $$ begin perform pg_temp.assume_user('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e402'); end $$;
set local role authenticated;

select public.respond_fill_in(
  (select first_request from game_ids where label = 'upgrade-confirmed'),
  'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e421'
);

reset role;
do $$ begin perform pg_temp.assume_user('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401'); end $$;
set local role authenticated;

select public.confirm_fill_in(
  (select first_request from game_ids where label = 'upgrade-confirmed'),
  'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e421'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select public.request_fill_in(
      (select event_id from game_ids where label = 'upgrade-confirmed')
    )
  $sql$),
  'CONFLICT',
  'a confirmed event still denies another request after the upgrade'
);

reset role;

select is(
  public.apply_notification_provider_result(
    (
      select id
      from public.notification_requests
      where notification_type = 'FILL_IN_REQUESTED'
        and source_id = (select first_request from game_ids where label = 'upgrade-confirmed')
    ),
    'ExponentPushToken[upgrade]',
    'OK'
  ),
  'SKIPPED',
  'the forward migration leaves a confirmed request notice undeliverable'
);

do $$ begin perform pg_temp.assume_user('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401'); end $$;
set local role authenticated;

insert into game_ids (label, event_id)
select 'upgrade-conflict', pg_temp.fresh_game('Upgrade Conflict', '2026-11-28 18:30:00+11');

reset role;

-- The earlier migration allowed two OPEN rows because the index was gone.
drop index public.fill_in_requests_one_open;

insert into public.fill_in_requests (
  id, club_id, team_id, event_id, requested_by, status
)
values
  (
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e431',
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4',
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e412',
    (select event_id from game_ids where label = 'upgrade-conflict'),
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401',
    'OPEN'
  ),
  (
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e432',
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4',
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e412',
    (select event_id from game_ids where label = 'upgrade-conflict'),
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e401',
    'OPEN'
  );

create temp table upgrade_conflict_message as
select pg_temp.sqlerrm_of(
  'select public.restore_fill_in_open_request_invariant()'
) as message;

select ok(
  (select message from upgrade_conflict_message)
    like 'FILL_IN_OPEN_REQUEST_HISTORY_CONFLICT%',
  'duplicate open requests abort the forward upgrade'
);

select ok(
  (select message from upgrade_conflict_message)
    like '%' || (select event_id::text from game_ids where label = 'upgrade-conflict') || '%',
  'the operator exception names the conflicting event'
);

select is(
  (
    select count(*)::integer
    from public.fill_in_requests
    where event_id = (select event_id from game_ids where label = 'upgrade-conflict')
      and status = 'OPEN'
      and id in (
        'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e431',
        'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e432'
      )
  ),
  2,
  'both historical open requests are preserved'
);

select ok(
  not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'fill_in_requests_one_open'
  ),
  'a conflicting upgrade does not create the open-request index'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where target_id in (
      'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e431',
      'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e432'
    )
  ),
  0,
  'the open-request preflight does not write audit history'
);

select * from finish();
rollback;
