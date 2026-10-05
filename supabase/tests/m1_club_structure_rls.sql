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
    json_build_object(
      'sub', target,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

select plan(174);

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

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
  'authenticated', 'authenticated', 'policy-other-admin@local.stable.test', '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.seasons (id, club_id, name, active)
values (
  '13131313-1313-4131-8131-131313131313',
  '11111111-1111-4111-8111-111111111111',
  'Second Season',
  true
);

insert into public.competitions (id, club_id, season_id, name, active)
values
  (
    '19191919-1919-4191-8191-191919191919',
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    'Matrix Championship',
    true
  ),
  (
    '14141414-1414-4141-8141-141414141414',
    '11111111-1111-4111-8111-111111111111',
    '13131313-1313-4131-8131-131313131313',
    'Second Championship',
    true
  ),
  (
    '16161616-1616-4161-8161-161616161616',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '12121212-1212-4121-8121-121212121212',
    'Other Championship',
    true
  );

insert into public.venues (id, club_id, name, active)
values
  (
    '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
    '11111111-1111-4111-8111-111111111111',
    'Matrix Court',
    true
  ),
  (
    '15151515-1515-4151-8151-151515151515',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Other Court',
    true
  );

insert into public.teams (id, club_id, season_id, name, active)
values (
  '18181818-1818-4181-8181-181818181818',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '12121212-1212-4121-8121-121212121212',
  'Other Team',
  true
);

insert into public.audit_events (id, club_id, actor_user_id, action, target_id)
values
  (
    '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'season.created',
    '88888888-8888-4888-8888-888888888888'
  ),
  (
    '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
    'season.created',
    '12121212-1212-4121-8121-121212121212'
  );

insert into public.club_memberships (id, club_id, user_id, role, active)
values
  (
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'CLUB_ADMIN',
    true
  ),
  (
    'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
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

select is(
  (select name from public.competitions where id = '19191919-1919-4191-8191-191919191919'),
  'Matrix Championship',
  'active member can select a club competition'
);
select is(
  (select name from public.venues where id = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'),
  'Matrix Court',
  'active member can select a club venue'
);
select is(
  (
    select action
    from public.audit_events
    where id = '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b'
  ),
  'season.created',
  'active member can select a club audit event'
);
select is_empty(
  $$select id from public.competitions where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member cannot select another club competition'
);
select is_empty(
  $$select id from public.venues where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member cannot select another club venue'
);
select is_empty(
  $$select id from public.teams where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member cannot select another club team'
);
select is_empty(
  $$select id from public.audit_events where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member cannot select another club audit event'
);

select is(
  pg_temp.sqlstate_of(statement),
  '42501',
  description
)
from (
  values
    ('insert into public.seasons default values', 'authenticated cannot insert seasons directly in the matrix'),
    ('update public.seasons set name = name', 'authenticated cannot update seasons directly'),
    ('delete from public.seasons', 'authenticated cannot delete seasons directly'),
    ('insert into public.competitions default values', 'authenticated cannot insert competitions directly'),
    ('update public.competitions set name = name', 'authenticated cannot update competitions directly'),
    ('delete from public.competitions', 'authenticated cannot delete competitions directly'),
    ('insert into public.venues default values', 'authenticated cannot insert venues directly'),
    ('update public.venues set name = name', 'authenticated cannot update venues directly'),
    ('delete from public.venues', 'authenticated cannot delete venues directly'),
    ('insert into public.teams default values', 'authenticated cannot insert teams directly'),
    ('update public.teams set name = name', 'authenticated cannot update teams directly'),
    ('delete from public.teams', 'authenticated cannot delete teams directly'),
    ('insert into public.audit_events default values', 'authenticated cannot insert audit events directly'),
    ('update public.audit_events set action = action', 'authenticated cannot update audit events directly'),
    ('delete from public.audit_events', 'authenticated cannot delete audit events directly')
) as direct_writes(statement, description);

select lives_ok(
  $$select public.update_club_competition(
    (select id from public.competitions where name = 'Championship'),
    'Championship',
    false
  )$$,
  'club admin can deactivate a competition'
);
select is(
  (select active from public.competitions where name = 'Championship'),
  false,
  'deactivated competition stays in the club and is inactive'
);
select is(
  (select club_id from public.competitions where name = 'Championship'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'competition update cannot change club'
);
select is(
  (select season_id from public.competitions where name = 'Championship'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  'competition update cannot change season'
);

select lives_ok(
  $$select public.update_club_venue(
    (select id from public.venues where name = 'Home Court'),
    'Home Court',
    false
  )$$,
  'club admin can deactivate a venue'
);
select is(
  (select active from public.venues where name = 'Home Court'),
  false,
  'deactivated venue stays in the club and is inactive'
);
select is(
  (select club_id from public.venues where name = 'Home Court'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'venue update cannot change club'
);

select lives_ok(
  $$select public.update_club_team(
    (select id from public.teams where name = 'U16 Boys'),
    'U16 Boys',
    false
  )$$,
  'club admin can deactivate a team'
);
select is(
  (select active from public.teams where name = 'U16 Boys'),
  false,
  'deactivated team stays in the club and is inactive'
);
select is(
  (select club_id from public.teams where name = 'U16 Boys'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'team update cannot change club'
);
select is(
  (select season_id from public.teams where name = 'U16 Boys'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  'team update cannot change season'
);
select is(
  (select competition_id from public.teams where name = 'U16 Boys'),
  (select id from public.competitions where name = 'Championship'),
  'team update cannot change competition'
);
select is(
  (select venue_id from public.teams where name = 'U16 Boys'),
  (select id from public.venues where name = 'Home Court'),
  'team update cannot change venue'
);

select throws_ok(
  $$select public.create_club_competition(
    '11111111-1111-4111-8111-111111111111',
    '12121212-1212-4121-8121-121212121212',
    'Foreign Competition'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'competition cannot use a season from another club'
);
select throws_ok(
  $$select public.create_club_team(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    '16161616-1616-4161-8161-161616161616',
    null,
    'Foreign Competition Team'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'team cannot use a competition from another club'
);
select throws_ok(
  $$select public.create_club_team(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    null,
    '15151515-1515-4151-8151-151515151515',
    'Foreign Venue Team'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'team cannot use a venue from another club'
);
select throws_ok(
  $$select public.create_club_team(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    '14141414-1414-4141-8141-141414141414',
    null,
    'Wrong Season Competition Team'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'team competition must belong to the selected season'
);

select ok(
  exists (
    select 1
    from public.audit_events
    where action = audit_action
      and club_id = '11111111-1111-4111-8111-111111111111'
      and actor_user_id = '55555555-5555-4555-8555-555555555555'
      and target_id = audit_target
      and created_at <= clock_timestamp()
      and created_at > clock_timestamp() - interval '5 minutes'
  ),
  audit_label
)
from (
  values
    (
      'season.created',
      (select id from public.seasons where name = 'Spring 1.1'),
      'season.created audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'season.updated',
      (select id from public.seasons where name = 'Spring 1.1'),
      'season.updated audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'competition.created',
      (select id from public.competitions where name = 'Championship'),
      'competition.created audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'competition.updated',
      (select id from public.competitions where name = 'Championship'),
      'competition.updated audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'venue.created',
      (select id from public.venues where name = 'Home Court'),
      'venue.created audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'venue.updated',
      (select id from public.venues where name = 'Home Court'),
      'venue.updated audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'team.created',
      (select id from public.teams where name = 'U16 Boys'),
      'team.created audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'team.updated',
      (select id from public.teams where name = 'U16 Boys'),
      'team.updated audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'season.created',
      (select id from public.seasons where name = 'Autumn'),
      'combined season audit uses auth.uid(), club, target, and a database timestamp'
    ),
    (
      'team.created',
      (select id from public.teams where name = 'U12 Girls'),
      'combined team audit uses auth.uid(), club, target, and a database timestamp'
    )
) as audits(audit_action, audit_target, audit_label);

select is(
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    '00000000-0000-4000-8000-000000000099'
  )),
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    real_other_club_id
  )),
  format('%s does not reveal another club id', function_name)
)
from (
  values
    ('update_club_season', '12121212-1212-4121-8121-121212121212'),
    ('update_club_competition', '16161616-1616-4161-8161-161616161616'),
    ('update_club_venue', '15151515-1515-4151-8151-151515151515'),
    ('update_club_team', '18181818-1818-4181-8181-181818181818')
) as updates(function_name, real_other_club_id);
select is(
  pg_temp.sqlstate_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    real_other_club_id
  )),
  'P0002',
  format('%s reports not found for another club', function_name)
)
from (
  values
    ('update_club_season', '12121212-1212-4121-8121-121212121212'),
    ('update_club_competition', '16161616-1616-4161-8161-161616161616'),
    ('update_club_venue', '15151515-1515-4151-8151-151515151515'),
    ('update_club_team', '18181818-1818-4181-8181-181818181818')
) as updates(function_name, real_other_club_id);

reset role;
do $$
begin
  perform pg_temp.assume_user('66666666-6666-4666-8666-666666666666');
end $$;
set local role authenticated;

select is_empty($$select id from public.competitions$$, 'outsider cannot select competitions');
select is_empty($$select id from public.venues$$, 'outsider cannot select venues');
select throws_ok(
  statement,
  '42501',
  'FORBIDDEN',
  description
)
from (
  values
    (
      $$select public.create_club_competition('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'Nope')$$,
      'outsider cannot create a competition'
    ),
    (
      $$select public.create_club_venue('11111111-1111-4111-8111-111111111111', 'Nope')$$,
      'outsider cannot create a venue'
    ),
    (
      $$select public.create_club_team('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', null, null, 'Nope')$$,
      'outsider cannot create a team'
    ),
    (
      $$select public.create_club_season_and_team('11111111-1111-4111-8111-111111111111', 'Nope', 'Nope')$$,
      'outsider cannot create a season and team'
    )
) as denied_creates(statement, description);
select is(
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    real_id
  )),
  'NOT_FOUND',
  format('outsider %s does not reveal a real id', function_name)
)
from (
  values
    ('update_club_season', '88888888-8888-4888-8888-888888888888'),
    ('update_club_competition', '19191919-1919-4191-8191-191919191919'),
    ('update_club_venue', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'),
    ('update_club_team', '99999999-9999-4999-8999-999999999999')
) as updates(function_name, real_id);

reset role;
update public.club_memberships
set active = false
where id = '77777777-7777-4777-8777-777777777777';
do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select is_empty($$select id from public.competitions$$, 'revoked member cannot select competitions');
select is_empty($$select id from public.venues$$, 'revoked member cannot select venues');
select is_empty($$select id from public.teams$$, 'revoked member cannot select teams');
select is_empty($$select id from public.audit_events$$, 'revoked member cannot select audit events');
select throws_ok(
  statement,
  '42501',
  'FORBIDDEN',
  description
)
from (
  values
    (
      $$select public.create_club_season('11111111-1111-4111-8111-111111111111', 'Nope')$$,
      'revoked member cannot create a season'
    ),
    (
      $$select public.create_club_competition('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'Nope')$$,
      'revoked member cannot create a competition'
    ),
    (
      $$select public.create_club_venue('11111111-1111-4111-8111-111111111111', 'Nope')$$,
      'revoked member cannot create a venue'
    ),
    (
      $$select public.create_club_team('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', null, null, 'Nope')$$,
      'revoked member cannot create a team'
    ),
    (
      $$select public.create_club_season_and_team('11111111-1111-4111-8111-111111111111', 'Nope', 'Nope')$$,
      'revoked member cannot create a season and team'
    )
) as revoked_creates(statement, description);
select is(
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    real_id
  )),
  'NOT_FOUND',
  format('revoked %s does not reveal a real id', function_name)
)
from (
  values
    ('update_club_season', '88888888-8888-4888-8888-888888888888'),
    ('update_club_competition', '19191919-1919-4191-8191-191919191919'),
    ('update_club_venue', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'),
    ('update_club_team', '99999999-9999-4999-8999-999999999999')
) as updates(function_name, real_id);

reset role;
update public.club_memberships
set active = true
where id = '77777777-7777-4777-8777-777777777777';

do $$
begin
  perform pg_temp.assume_user('bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc');
end $$;
set local role authenticated;

select is(
  (select name from public.seasons where id = '12121212-1212-4121-8121-121212121212'),
  'Other Season',
  'other club admin can select that club season'
);
select is(
  (select name from public.competitions where id = '16161616-1616-4161-8161-161616161616'),
  'Other Championship',
  'other club admin can select that club competition'
);
select is(
  (select name from public.venues where id = '15151515-1515-4151-8151-151515151515'),
  'Other Court',
  'other club admin can select that club venue'
);
select is(
  (select name from public.teams where id = '18181818-1818-4181-8181-181818181818'),
  'Other Team',
  'other club admin can select that club team'
);
select is(
  (
    select action
    from public.audit_events
    where id = '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c'
  ),
  'season.created',
  'other club admin can select that club audit event'
);
select is_empty(
  $$select id from public.seasons where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other club admin cannot select this club seasons'
);
select is_empty(
  $$select id from public.competitions where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other club admin cannot select this club competitions'
);
select is_empty(
  $$select id from public.venues where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other club admin cannot select this club venues'
);
select is_empty(
  $$select id from public.teams where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other club admin cannot select this club teams'
);
select is_empty(
  $$select id from public.audit_events where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other club admin cannot select this club audit events'
);
select lives_ok(
  $$select public.update_club_season(
    '12121212-1212-4121-8121-121212121212',
    'Other Season',
    true
  )$$,
  'other club admin can update that club season'
);
select throws_ok(
  statement,
  '42501',
  'FORBIDDEN',
  description
)
from (
  values
    (
      $$select public.create_club_season('11111111-1111-4111-8111-111111111111', 'Nope')$$,
      'other club admin cannot create a season here'
    ),
    (
      $$select public.create_club_competition('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'Nope')$$,
      'other club admin cannot create a competition here'
    ),
    (
      $$select public.create_club_venue('11111111-1111-4111-8111-111111111111', 'Nope')$$,
      'other club admin cannot create a venue here'
    ),
    (
      $$select public.create_club_team('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', null, null, 'Nope')$$,
      'other club admin cannot create a team here'
    ),
    (
      $$select public.create_club_season_and_team('11111111-1111-4111-8111-111111111111', 'Nope', 'Nope')$$,
      'other club admin cannot create a season and team here'
    )
) as foreign_creates(statement, description);
select is(
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    real_id
  )),
  pg_temp.sqlerrm_of(format(
    'select public.%I(%L, ''Hidden'', true)',
    function_name,
    '00000000-0000-4000-8000-000000000099'
  )),
  format('other club admin %s matches a missing id', function_name)
)
from (
  values
    ('update_club_season', '88888888-8888-4888-8888-888888888888'),
    ('update_club_competition', '19191919-1919-4191-8191-191919191919'),
    ('update_club_venue', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'),
    ('update_club_team', '99999999-9999-4999-8999-999999999999')
) as updates(function_name, real_id);

reset role;

select is(
  pg_temp.sqlstate_of(
    $$insert into public.teams (club_id, season_id, name)
      values (
        '11111111-1111-4111-8111-111111111111',
        '12121212-1212-4121-8121-121212121212',
        'FK Season'
      )$$
  ),
  '23503',
  'team season foreign key rejects another club'
);
select is(
  pg_temp.sqlstate_of(
    $$insert into public.teams (club_id, season_id, competition_id, name)
      values (
        '11111111-1111-4111-8111-111111111111',
        '88888888-8888-4888-8888-888888888888',
        '16161616-1616-4161-8161-161616161616',
        'FK Competition'
      )$$
  ),
  '23503',
  'team competition foreign key rejects another club'
);
select is(
  pg_temp.sqlstate_of(
    $$insert into public.teams (club_id, season_id, venue_id, name)
      values (
        '11111111-1111-4111-8111-111111111111',
        '88888888-8888-4888-8888-888888888888',
        '15151515-1515-4151-8151-151515151515',
        'FK Venue'
      )$$
  ),
  '23503',
  'team venue foreign key rejects another club'
);

select is(
  p.proargnames,
  expected_args,
  format('%s accepts only id, name, and active', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
join (
  values
    ('update_club_season', array['p_season_id', 'p_name', 'p_active']),
    ('update_club_competition', array['p_competition_id', 'p_name', 'p_active']),
    ('update_club_venue', array['p_venue_id', 'p_name', 'p_active']),
    ('update_club_team', array['p_team_id', 'p_name', 'p_active'])
) as expected(function_name, expected_args)
  on expected.function_name = p.proname
where n.nspname = 'public';

select ok(
  p.proacl is not null
    and not exists (
      select 1
      from aclexplode(p.proacl) as acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    )
    and not has_function_privilege(
      'anon',
      p.oid,
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      p.oid,
      'execute'
    ),
  format('authenticated alone can execute %s', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_club_season',
    'update_club_season',
    'create_club_competition',
    'update_club_competition',
    'create_club_venue',
    'update_club_venue',
    'create_club_team',
    'update_club_team',
    'create_club_season_and_team'
  );

select ok(
  p.proacl is not null
    and not exists (
      select 1
      from aclexplode(p.proacl) as acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    )
    and not has_function_privilege('anon', p.oid, 'execute')
    and not has_function_privilege('authenticated', p.oid, 'execute'),
  format('clients cannot execute %s', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('assert_club_structure_admin', 'structure_name');

create or replace function pg_temp.fail_audit_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit insert forced to fail';
end;
$$;

create trigger club_structure_audit_fail
  before insert on public.audit_events
  for each row
  execute function pg_temp.fail_audit_insert();

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

do $$
begin
  perform set_config(
    'club_structure.audit_count',
    (select count(*)::text from public.audit_events),
    true
  );
end $$;

select is(
  pg_temp.sqlstate_of(
    $$select public.create_club_season(
      '11111111-1111-4111-8111-111111111111',
      'Atomic Season'
    )$$
  ),
  'P0001',
  'season create aborts when the audit insert fails'
);
select is_empty(
  $$select id from public.seasons where name = 'Atomic Season'$$,
  'failed audit leaves no season'
);
select is(
  (select count(*)::text from public.audit_events),
  current_setting('club_structure.audit_count'),
  'failed audit leaves no audit row'
);

reset role;
drop trigger club_structure_audit_fail on public.audit_events;
drop function pg_temp.fail_audit_insert();

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
select is(
  pg_temp.sqlstate_of(statement),
  '42501',
  description
)
from (
  values
    (
      $$select public.update_club_season('88888888-8888-4888-8888-888888888888', 'Anon', true)$$,
      'anon cannot execute update_club_season'
    ),
    (
      $$select public.create_club_competition('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 'Anon')$$,
      'anon cannot execute create_club_competition'
    ),
    (
      $$select public.update_club_competition('19191919-1919-4191-8191-191919191919', 'Anon', true)$$,
      'anon cannot execute update_club_competition'
    ),
    (
      $$select public.create_club_venue('11111111-1111-4111-8111-111111111111', 'Anon')$$,
      'anon cannot execute create_club_venue'
    ),
    (
      $$select public.update_club_venue('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Anon', true)$$,
      'anon cannot execute update_club_venue'
    ),
    (
      $$select public.create_club_team('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', null, null, 'Anon')$$,
      'anon cannot execute create_club_team'
    ),
    (
      $$select public.update_club_team('99999999-9999-4999-8999-999999999999', 'Anon', true)$$,
      'anon cannot execute update_club_team'
    ),
    (
      $$select public.create_club_season_and_team('11111111-1111-4111-8111-111111111111', 'Anon', 'Anon')$$,
      'anon cannot execute create_club_season_and_team'
    )
) as anon_calls(statement, description);
select is(
  pg_temp.sqlstate_of(statement),
  '42501',
  description
)
from (
  values
    ('insert into public.seasons default values', 'anon cannot insert seasons'),
    ('update public.seasons set name = name', 'anon cannot update seasons'),
    ('delete from public.seasons', 'anon cannot delete seasons'),
    ('insert into public.competitions default values', 'anon cannot insert competitions'),
    ('update public.competitions set name = name', 'anon cannot update competitions'),
    ('delete from public.competitions', 'anon cannot delete competitions'),
    ('insert into public.venues default values', 'anon cannot insert venues'),
    ('update public.venues set name = name', 'anon cannot update venues'),
    ('delete from public.venues', 'anon cannot delete venues'),
    ('insert into public.teams default values', 'anon cannot insert teams'),
    ('update public.teams set name = name', 'anon cannot update teams'),
    ('delete from public.teams', 'anon cannot delete teams'),
    ('insert into public.audit_events default values', 'anon cannot insert audit events'),
    ('update public.audit_events set action = action', 'anon cannot update audit events'),
    ('delete from public.audit_events', 'anon cannot delete audit events')
) as anon_writes(statement, description);

select * from finish();

rollback;
