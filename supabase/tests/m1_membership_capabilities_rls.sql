-- Slice 1.4 team staff, player registration, and revocation.
-- Fixtures are local policy users only. They are not a sign-in path.

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
    json_build_object(
      'sub', target,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.clear_user()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-191919191919', 'authenticated', 'authenticated', 'membership-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191a', 'authenticated', 'authenticated', 'membership-target@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191b', 'authenticated', 'authenticated', 'membership-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191c', 'authenticated', 'authenticated', 'membership-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191d', 'authenticated', 'authenticated', 'membership-other-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191e', 'authenticated', 'authenticated', 'membership-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-19191919191f', 'authenticated', 'authenticated', 'membership-other-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '19191919-1919-4919-8919-191919191920', 'authenticated', 'authenticated', 'membership-revoked@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('19191919-1919-4919-8919-191919191919', 'Membership Admin', 'Membership', 'Admin'),
  ('19191919-1919-4919-8919-19191919191a', 'Assignable Adult', 'Assignable', 'Adult'),
  ('19191919-1919-4919-8919-19191919191b', 'Team Coach', 'Team', 'Coach'),
  ('19191919-1919-4919-8919-19191919191c', 'Child Guardian', 'Child', 'Guardian'),
  ('19191919-1919-4919-8919-19191919191d', 'Other Guardian', 'Other', 'Guardian'),
  ('19191919-1919-4919-8919-19191919191f', 'Other Admin', 'Other', 'Admin'),
  ('19191919-1919-4919-8919-191919191920', 'Revoked Admin', 'Revoked', 'Admin');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('14141414-1414-4414-8414-141414141414', 'Membership Club', 'membership-club', 'Australia/Melbourne', 'mustangs'),
  ('15151515-1515-4515-8515-151515151515', 'Membership Other', 'membership-other', 'Australia/Melbourne', 'other');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('14141414-1414-4414-8414-141414141414', '19191919-1919-4919-8919-191919191919', 'CLUB_ADMIN', true),
  ('14141414-1414-4414-8414-141414141414', '19191919-1919-4919-8919-19191919191a', 'CLUB_ADMIN', true),
  ('15151515-1515-4515-8515-151515151515', '19191919-1919-4919-8919-19191919191f', 'CLUB_ADMIN', true),
  ('14141414-1414-4414-8414-141414141414', '19191919-1919-4919-8919-191919191920', 'CLUB_ADMIN', false);

insert into public.seasons (id, club_id, name)
values
  ('16161616-1616-4616-8616-161616161616', '14141414-1414-4414-8414-141414141414', 'Membership Season'),
  ('16161616-1616-4616-8616-161616161617', '15151515-1515-4515-8515-151515151515', 'Other Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414', '16161616-1616-4616-8616-161616161616', 'Team A', true),
  ('17171717-1717-4717-8717-171717171718', '14141414-1414-4414-8414-141414141414', '16161616-1616-4616-8616-161616161616', 'Team B', true),
  ('17171717-1717-4717-8717-171717171719', '14141414-1414-4414-8414-141414141414', '16161616-1616-4616-8616-161616161616', 'Inactive Team', false),
  ('17171717-1717-4717-8717-17171717171a', '15151515-1515-4515-8515-151515151515', '16161616-1616-4616-8616-161616161617', 'Other Team', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('18181818-1818-4818-8818-181818181818', '14141414-1414-4414-8414-141414141414', 'Synthetic', 'One', true),
  ('18181818-1818-4818-8818-181818181819', '14141414-1414-4414-8414-141414141414', 'Synthetic', 'Two', true),
  ('18181818-1818-4818-8818-18181818181a', '14141414-1414-4414-8414-141414141414', 'Synthetic', 'Idle', false),
  ('18181818-1818-4818-8818-18181818181b', '15151515-1515-4515-8515-151515151515', 'Synthetic', 'Other', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('14141414-1414-4414-8414-141414141414', '17171717-1717-4717-8717-171717171717', '19191919-1919-4919-8919-19191919191b', 'HEAD_COACH', true),
  ('14141414-1414-4414-8414-141414141414', '17171717-1717-4717-8717-171717171717', '19191919-1919-4919-8919-19191919191b', 'TEAM_MANAGER', true),
  ('14141414-1414-4414-8414-141414141414', '17171717-1717-4717-8717-171717171718', '19191919-1919-4919-8919-19191919191a', 'ASSISTANT_COACH', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('14141414-1414-4414-8414-141414141414', '18181818-1818-4818-8818-181818181818', '19191919-1919-4919-8919-19191919191c', true),
  ('14141414-1414-4414-8414-141414141414', '18181818-1818-4818-8818-181818181819', '19191919-1919-4919-8919-19191919191d', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('14141414-1414-4414-8414-141414141414', '17171717-1717-4717-8717-171717171717', '18181818-1818-4818-8818-181818181818', true),
  ('14141414-1414-4414-8414-141414141414', '17171717-1717-4717-8717-171717171717', '18181818-1818-4818-8818-181818181819', true);

select has_table('public', 'team_memberships', 'team_memberships exists');
select has_table('public', 'player_team_registrations', 'player_team_registrations exists');
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.club_memberships (club_id, user_id, role, active)
      values ('14141414-1414-4414-8414-141414141414', '19191919-1919-4919-8919-19191919191e', 'HEAD_COACH', true)$$
  ) = '23514',
  'club membership role stays CLUB_ADMIN'
);
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.team_memberships (club_id, team_id, user_id, role)
      values (
        '14141414-1414-4414-8414-141414141414',
        '17171717-1717-4717-8717-171717171718',
        '19191919-1919-4919-8919-19191919191b',
        'GUARDIAN'
      )$$
  ) = '23514',
  'guardian is not a team staff role'
);
select is(
  (
    select count(*)
    from public.team_memberships
    where user_id = '19191919-1919-4919-8919-19191919191b'
      and team_id = '17171717-1717-4717-8717-171717171717'
  ),
  2::bigint,
  'one adult can hold two staff roles on the same team'
);
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.team_memberships (club_id, team_id, user_id, role)
      values (
        '14141414-1414-4414-8414-141414141414',
        '17171717-1717-4717-8717-171717171717',
        '19191919-1919-4919-8919-19191919191b',
        'HEAD_COACH'
      )$$
  ) = '23505',
  'the same staff role cannot be duplicated'
);
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.player_team_registrations (club_id, team_id, player_id, active)
      values (
        '14141414-1414-4414-8414-141414141414',
        '17171717-1717-4717-8717-171717171718',
        '18181818-1818-4818-8818-181818181818',
        true
      )$$
  ) = '23505',
  'a player cannot have two active team registrations'
);
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.team_memberships (club_id, team_id, user_id, role)
      values (
        '15151515-1515-4515-8515-151515151515',
        '17171717-1717-4717-8717-171717171717',
        '19191919-1919-4919-8919-19191919191b',
        'ASSISTANT_COACH'
      )$$
  ) = '23503',
  'a team membership cannot point at another club'
);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.team_memberships'::regclass),
  'team_memberships forces row level security'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.player_team_registrations'::regclass),
  'player_team_registrations forces row level security'
);

set local role anon;
select throws_ok(
  $$select id from public.team_memberships$$,
  '42501',
  null,
  'anon cannot select team memberships'
);
select throws_ok(
  $$insert into public.team_memberships (club_id, team_id, user_id, role)
    values (
      '14141414-1414-4414-8414-141414141414',
      '17171717-1717-4717-8717-171717171717',
      '19191919-1919-4919-8919-19191919191e',
      'HEAD_COACH'
    )$$,
  '42501',
  null,
  'anon cannot insert team memberships'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-19191919191e'); end $$;
set local role authenticated;
select is_empty(
  $$select id from public.team_memberships$$,
  'outsider cannot select team memberships'
);
select is_empty(
  $$select id from public.player_team_registrations$$,
  'outsider cannot select registrations'
);
select is_empty(
  $$select id from public.teams where club_id = '14141414-1414-4414-8414-141414141414'$$,
  'outsider cannot select teams'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-191919191919'); end $$;
set local role authenticated;
select is(
  (select count(*) from public.team_memberships where user_id = '19191919-1919-4919-8919-19191919191b'),
  2::bigint,
  'club admin sees every staff row for the coach'
);
select is(
  (select count(*) from public.player_team_registrations where club_id = '14141414-1414-4414-8414-141414141414'),
  2::bigint,
  'club admin sees club registrations'
);
select throws_ok(
  $$insert into public.team_memberships (club_id, team_id, user_id, role)
    values (
      '14141414-1414-4414-8414-141414141414',
      '17171717-1717-4717-8717-171717171718',
      '19191919-1919-4919-8919-191919191919',
      'TEAM_MANAGER'
    )$$,
  '42501',
  null,
  'club admin cannot insert staff directly'
);
select throws_ok(
  $$update public.team_memberships set active = false$$,
  '42501',
  null,
  'club admin cannot update staff directly'
);
select throws_ok(
  $$delete from public.player_team_registrations$$,
  '42501',
  null,
  'club admin cannot delete registrations directly'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-19191919191f'); end $$;
set local role authenticated;
select is_empty(
  $$select id from public.team_memberships where club_id = '14141414-1414-4414-8414-141414141414'$$,
  'other-club admin cannot select these staff rows'
);
select is_empty(
  $$select id from public.teams where id = '17171717-1717-4717-8717-171717171717'$$,
  'other-club admin cannot select this team'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-191919191920'); end $$;
set local role authenticated;
select is_empty(
  $$select id from public.team_memberships$$,
  'revoked admin cannot select staff rows'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-19191919191b'); end $$;
set local role authenticated;
select is(
  (select count(*) from public.team_memberships),
  2::bigint,
  'multi-role coach sees only their own active staff rows'
);
select is_empty(
  $$select id from public.team_memberships where team_id = '17171717-1717-4717-8717-171717171718' and role = 'ASSISTANT_COACH'$$,
  'coach cannot see another adult role on another team'
);
select is_empty(
  $$select id from public.player_team_registrations$$,
  'staff cannot select player registrations'
);
select is(
  (select name from public.teams where id = '17171717-1717-4717-8717-171717171717'),
  'Team A',
  'coach can select their own team'
);
select is_empty(
  $$select id from public.teams where id = '17171717-1717-4717-8717-171717171718'$$,
  'coach cannot select the other team'
);
select is(
  (select name from public.clubs where id = '14141414-1414-4414-8414-141414141414'),
  'Membership Club',
  'coach can select their club'
);
select is_empty(
  $$select id from public.clubs where id = '15151515-1515-4515-8515-151515151515'$$,
  'coach cannot select another club'
);
select is(
  (select display_name from public.profiles where user_id = '19191919-1919-4919-8919-19191919191b'),
  'Team Coach',
  'coach can select their own display name'
);
select is_empty(
  $$select user_id from public.profiles where user_id = '19191919-1919-4919-8919-191919191919'$$,
  'coach cannot select another adult profile'
);
select is_empty(
  $$select id from public.players$$,
  'coach cannot select player names'
);
reset role;

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-19191919191c'); end $$;
set local role authenticated;
select is(
  (select count(*) from public.guardian_relationships),
  1::bigint,
  'guardian sees only their own relationship'
);
select is(
  (select player_id from public.player_team_registrations),
  '18181818-1818-4818-8818-181818181818'::uuid,
  'guardian sees only their child registration'
);
select is_empty(
  $$select id from public.players$$,
  'guardian cannot select child names'
);
select is(
  (select name from public.teams where id = '17171717-1717-4717-8717-171717171717'),
  'Team A',
  'guardian can select the registered team'
);
select is_empty(
  $$select id from public.teams where id = '17171717-1717-4717-8717-171717171718'$$,
  'guardian cannot select a team their child is not on'
);
select is(
  (select display_name from public.profiles where user_id = '19191919-1919-4919-8919-19191919191c'),
  'Child Guardian',
  'guardian can select their own display name'
);
reset role;

select ok(
  p.prosecdef
    and (
      p.proconfig @> array['search_path=']
      or p.proconfig @> array['search_path=""']
    )
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute'),
  format('%s is a definer function for authenticated callers', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'assign_team_role',
    'revoke_team_role',
    'reactivate_team_role',
    'register_player_on_team',
    'unregister_player_from_team'
  );

select ok(
  p.prosecdef
    and pg_get_function_result(p.oid) = 'boolean'
    and pg_get_functiondef(p.oid) not like '%first_name%'
    and pg_get_functiondef(p.oid) not like '%last_name%'
    and pg_get_functiondef(p.oid) not like '%email%'
    and not has_function_privilege('anon', p.oid, 'execute'),
  format('%s returns only a boolean', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('player_is_active', 'team_is_active', 'caller_guards_player');

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-191919191919'); end $$;
set local role authenticated;

select lives_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171718',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  'admin can assign an existing club adult'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'team_staff.assigned'
      and club_id = '14141414-1414-4414-8414-141414141414'
  ),
  1::bigint,
  'assignment writes one audit row'
);
select lives_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171718',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  'repeating an assignment is allowed'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'team_staff.assigned'
      and club_id = '14141414-1414-4414-8414-141414141414'
  ),
  1::bigint,
  'a repeated assignment does not audit again'
);
select lives_ok(
  $$select public.revoke_team_role(
    '17171717-1717-4717-8717-171717171718',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  'admin can revoke a staff role'
);
select lives_ok(
  $$select public.revoke_team_role(
    '17171717-1717-4717-8717-171717171718',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  'repeating a revoke is allowed'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'team_staff.revoked'
      and club_id = '14141414-1414-4414-8414-141414141414'
  ),
  1::bigint,
  'a repeated revoke does not audit again'
);
select lives_ok(
  $$select public.reactivate_team_role(
    '17171717-1717-4717-8717-171717171718',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  'admin can reactivate a staff role'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'team_staff.reactivated'
      and club_id = '14141414-1414-4414-8414-141414141414'
  ),
  1::bigint,
  'reactivation writes one audit row'
);
select throws_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171719',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'an inactive team cannot receive a staff role'
);
select throws_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171717',
    '19191919-1919-4919-8919-19191919191b',
    'HEAD_COACH'
  )$$,
  'P0002',
  'NOT_FOUND',
  'an adult outside the club member set cannot be assigned'
);
select throws_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171717',
    '19191919-1919-4919-8919-19191919191a',
    'GUARDIAN'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'assign rejects a guardian staff role'
);
select is(
  pg_temp.sqlerrm_of(
    $$select public.assign_team_role(
      'abababab-abab-4aba-8aba-abababababab',
      '19191919-1919-4919-8919-19191919191a',
      'HEAD_COACH'
    )$$
  ),
  pg_temp.sqlerrm_of(
    $$select public.assign_team_role(
      '17171717-1717-4717-8717-17171717171a',
      '19191919-1919-4919-8919-19191919191a',
      'HEAD_COACH'
    )$$
  ),
  'missing and other-club teams fail the same way'
);
select throws_ok(
  $$select public.register_player_on_team(
    '18181818-1818-4818-8818-18181818181a',
    '17171717-1717-4717-8717-171717171718'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'an inactive player cannot be registered'
);
select lives_ok(
  $$select public.register_player_on_team(
    '18181818-1818-4818-8818-181818181818',
    '17171717-1717-4717-8717-171717171717'
  )$$,
  'registering the current team is idempotent'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player_team.registered'
      and club_id = '14141414-1414-4414-8414-141414141414'
  ),
  0::bigint,
  'an idempotent registration does not audit'
);
select lives_ok(
  $$select public.register_player_on_team(
    '18181818-1818-4818-8818-181818181818',
    '17171717-1717-4717-8717-171717171718'
  )$$,
  'moving a player deactivates the previous registration'
);
select is(
  (
    select active
    from public.player_team_registrations
    where player_id = '18181818-1818-4818-8818-181818181818'
      and team_id = '17171717-1717-4717-8717-171717171717'
  ),
  false,
  'the previous registration is inactive'
);
select is(
  (
    select active
    from public.player_team_registrations
    where player_id = '18181818-1818-4818-8818-181818181818'
      and team_id = '17171717-1717-4717-8717-171717171718'
  ),
  true,
  'the destination registration is active'
);
select is(
  (
    select count(*)
    from public.audit_events
    where club_id = '14141414-1414-4414-8414-141414141414'
      and action in ('player_team.registered', 'player_team.unregistered')
  ),
  2::bigint,
  'a move audits unregister and register'
);
select is(
  pg_temp.sqlerrm_of(
    $$select public.register_player_on_team(
      'abababab-abab-4aba-8aba-abababababab',
      '17171717-1717-4717-8717-171717171718'
    )$$
  ),
  pg_temp.sqlerrm_of(
    $$select public.register_player_on_team(
      '18181818-1818-4818-8818-18181818181b',
      '17171717-1717-4717-8717-171717171718'
    )$$
  ),
  'missing and other-club players fail the same way'
);

reset role;
create or replace function pg_temp.fail_audit_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit insert forced to fail';
end;
$$;
create trigger membership_audit_fail
  before insert on public.audit_events
  for each row
  execute function pg_temp.fail_audit_insert();

do $$ begin perform pg_temp.assume_user('19191919-1919-4919-8919-191919191919'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlstate_of(
    $$select public.assign_team_role(
      '17171717-1717-4717-8717-171717171717',
      '19191919-1919-4919-8919-19191919191a',
      'TEAM_MANAGER'
    )$$
  ),
  'P0001',
  'staff assignment aborts when the audit insert fails'
);
select is_empty(
  $$select id from public.team_memberships
    where user_id = '19191919-1919-4919-8919-19191919191a'
      and role = 'TEAM_MANAGER'$$,
  'failed staff audit leaves no membership'
);
reset role;
drop trigger membership_audit_fail on public.audit_events;

do $$ begin perform pg_temp.clear_user(); end $$;
set local role authenticated;
select throws_ok(
  $$select public.assign_team_role(
    '17171717-1717-4717-8717-171717171717',
    '19191919-1919-4919-8919-19191919191a',
    'HEAD_COACH'
  )$$,
  '28000',
  'UNAUTHENTICATED',
  'a session without an actor cannot assign a role'
);

select * from finish();
rollback;
