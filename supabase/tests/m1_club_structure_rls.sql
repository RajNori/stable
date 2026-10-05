-- Slice 1.1 RLS and audited club-structure commands.
--
-- Same-club wrong-team deny is not expressible yet. Team membership does
-- not exist until a later slice. This file still proves cross-club denial.
-- Policy users here are not login users.

begin;

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
    json_build_object(
      'sub', target,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

select plan(30);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'policy-member@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'policy-outsider@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

insert into public.clubs (id, name, slug, timezone, theme_key, active)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Other Club',
  'other-club',
  'Australia/Melbourne',
  'other',
  true
);

insert into public.seasons (id, club_id, name, active)
values (
  '12121212-1212-4121-8121-121212121212',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Other Season',
  true
);

insert into public.club_memberships (id, club_id, user_id, role, active)
values (
  '77777777-7777-4777-8777-777777777777',
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'CLUB_ADMIN',
  true
);

select has_table('public', 'seasons', 'seasons table exists');
select has_table('public', 'competitions', 'competitions table exists');
select has_table('public', 'venues', 'venues table exists');
select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'audit_events', 'audit_events table exists');

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select is(
  (select name from public.seasons where id = '88888888-8888-4888-8888-888888888888'),
  '2026 Winter',
  'active member can select the seeded season'
);
select is(
  (select name from public.teams where id = '99999999-9999-4999-8999-999999999999'),
  'U14 Boys',
  'active member can select the seeded team'
);

reset role;
do $$
begin
  perform pg_temp.assume_user('66666666-6666-4666-8666-666666666666');
end $$;
set local role authenticated;

select is_empty($$select id from public.seasons$$, 'outsider cannot select seasons');
select is_empty($$select id from public.teams$$, 'outsider cannot select teams');
select is_empty(
  $$select id from public.audit_events$$,
  'outsider cannot select audit events'
);

reset role;
update public.club_memberships
set active = false
where id = '77777777-7777-4777-8777-777777777777';

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select is_empty(
  $$select id from public.seasons$$,
  'revoked member cannot select seasons'
);

reset role;
update public.club_memberships
set active = true
where id = '77777777-7777-4777-8777-777777777777';

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select is_empty(
  $$select id from public.seasons where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member cannot select another club season'
);

select is(
  pg_temp.sqlstate_of(
    $$insert into public.seasons (club_id, name) values ('11111111-1111-4111-8111-111111111111', 'Direct')$$
  ),
  '42501',
  'authenticated cannot insert seasons directly'
);

select lives_ok(
  $$select public.create_club_season('11111111-1111-4111-8111-111111111111', 'Spring 1.1')$$,
  'club admin can create a season'
);
select is(
  (
    select action
    from public.audit_events
    where target_id = (select id from public.seasons where name = 'Spring 1.1')
  ),
  'season.created',
  'season create writes an audit event'
);

select lives_ok(
  $$select public.create_club_competition(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    'Championship'
  )$$,
  'club admin can create a competition in the club season'
);
select lives_ok(
  $$select public.create_club_venue('11111111-1111-4111-8111-111111111111', 'Home Court')$$,
  'club admin can create a venue'
);
select lives_ok(
  $$select public.create_club_team(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    (select id from public.competitions where name = 'Championship'),
    (select id from public.venues where name = 'Home Court'),
    'U16 Boys'
  )$$,
  'club admin can create a team in the club season'
);

select lives_ok(
  $$select public.update_club_season(
    (select id from public.seasons where name = 'Spring 1.1'),
    'Spring 1.1',
    false
  )$$,
  'club admin can deactivate a season'
);
select is(
  (select active from public.seasons where name = 'Spring 1.1'),
  false,
  'deactivated season stays in the club and is inactive'
);

reset role;
do $$
begin
  perform pg_temp.assume_user('66666666-6666-4666-8666-666666666666');
end $$;
set local role authenticated;

select throws_ok(
  $$select public.create_club_season('11111111-1111-4111-8111-111111111111', 'Nope')$$,
  '42501',
  'FORBIDDEN',
  'outsider cannot create a season'
);

reset role;
do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select throws_ok(
  $$select public.create_club_team(
    '11111111-1111-4111-8111-111111111111',
    '12121212-1212-4121-8121-121212121212',
    null,
    null,
    'Wrong Club Team'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'team cannot use a season from another club'
);

select lives_ok(
  $$select public.create_club_season_and_team(
    '11111111-1111-4111-8111-111111111111',
    'Autumn',
    'U12 Girls'
  )$$,
  'club admin can create a season and team together'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action in ('season.created', 'team.created')
      and target_id in (
        select id from public.seasons where name = 'Autumn'
        union all
        select id from public.teams where name = 'U12 Girls'
      )
  ),
  2::bigint,
  'combined create writes a season audit and a team audit'
);

reset role;
set local role anon;

select is(
  pg_temp.sqlstate_of('select id from public.seasons'),
  '42501',
  'anon cannot select seasons'
);
select is(
  pg_temp.sqlstate_of('select id from public.competitions'),
  '42501',
  'anon cannot select competitions'
);
select is(
  pg_temp.sqlstate_of('select id from public.venues'),
  '42501',
  'anon cannot select venues'
);
select is(
  pg_temp.sqlstate_of('select id from public.teams'),
  '42501',
  'anon cannot select teams'
);
select is(
  pg_temp.sqlstate_of('select id from public.audit_events'),
  '42501',
  'anon cannot select audit events'
);
select is(
  pg_temp.sqlstate_of(
    $$select public.create_club_season('11111111-1111-4111-8111-111111111111', 'Anon')$$
  ),
  '42501',
  'anon cannot execute create_club_season'
);

select * from finish();

rollback;
