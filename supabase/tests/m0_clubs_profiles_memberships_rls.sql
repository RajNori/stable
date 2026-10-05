-- Milestone 0 RLS for clubs, profiles, and club_memberships.
--
-- Same-club wrong-team deny is N/A. Milestone 0 has no team table and no
-- team membership, so a same-club wrong-team denial cannot be expressed.
-- Milestone 1 must add that deny test when teams exist.
--
-- Rows inserted into auth.users below are foreign-key placeholders for this
-- pgTAP file only. They are not a sign-in path.
-- Policy member: 55555555-5555-4555-8555-555555555555 policy-member@local.stable.test
-- Policy outsider: 66666666-6666-4666-8666-666666666666 policy-outsider@local.stable.test
-- Policy membership: 77777777-7777-4777-8777-777777777777
-- Login users 22222222-2222-4222-8222-222222222222 and
-- 33333333-3333-4333-8333-333333333333 are created later by
-- scripts/bootstrap-local-auth.ts. These files must not share ids or emails.

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
    json_build_object(
      'sub', target,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

select plan(33);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'policy-member@local.stable.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated',
    'authenticated',
    'policy-outsider@local.stable.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into public.clubs (
  id,
  name,
  slug,
  timezone,
  theme_key,
  active
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Mentone Mustangs',
  'mentone-mustangs',
  'Australia/Melbourne',
  'mustangs',
  true
)
on conflict (id) do nothing;

insert into public.clubs (
  id,
  name,
  slug,
  timezone,
  theme_key,
  active
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Other Club',
  'other-club',
  'Australia/Melbourne',
  'other',
  true
);

insert into public.profiles (
  user_id,
  display_name,
  first_name,
  last_name,
  email,
  locale
)
values
  (
    '55555555-5555-4555-8555-555555555555',
    'Local Member',
    'Local',
    'Member',
    'policy-member@local.stable.test',
    'en-AU'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Local Outsider',
    'Local',
    'Outsider',
    'policy-outsider@local.stable.test',
    'en-AU'
  );

insert into public.club_memberships (
  id,
  club_id,
  user_id,
  role,
  active
)
values (
  '77777777-7777-4777-8777-777777777777',
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'CLUB_ADMIN',
  true
);

select has_table('public', 'clubs', 'clubs table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'club_memberships', 'club_memberships table exists');

select ok(
  (
    select cls.relrowsecurity
    from pg_class as cls
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'clubs'
  ),
  'RLS is enabled on clubs'
);
select ok(
  (
    select cls.relrowsecurity
    from pg_class as cls
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'profiles'
  ),
  'RLS is enabled on profiles'
);
select ok(
  (
    select cls.relrowsecurity
    from pg_class as cls
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'club_memberships'
  ),
  'RLS is enabled on club_memberships'
);

select is(
  (
    select coalesce(array_agg(pol.polname::text order by pol.polname), '{}')
    from pg_policy as pol
    join pg_class as cls on cls.oid = pol.polrelid
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'clubs'
  ),
  array['clubs_select_active_member']::text[],
  'clubs exposes only the active-member select policy'
);
select is(
  (
    select coalesce(array_agg(pol.polname::text order by pol.polname), '{}')
    from pg_policy as pol
    join pg_class as cls on cls.oid = pol.polrelid
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'profiles'
  ),
  array['profiles_select_own_active_member']::text[],
  'profiles exposes only the own active-member select policy'
);
select is(
  (
    select coalesce(array_agg(pol.polname::text order by pol.polname), '{}')
    from pg_policy as pol
    join pg_class as cls on cls.oid = pol.polrelid
    join pg_namespace as nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'club_memberships'
  ),
  array['club_memberships_select_own_active']::text[],
  'club_memberships exposes only the own active-row select policy'
);

select has_index(
  'public',
  'club_memberships',
  'club_memberships_one_active_per_club_user',
  'one active membership per club and user'
);

select is(
  pg_temp.sqlstate_of(
    $$
      insert into public.club_memberships (club_id, user_id, role, active)
      values (
        '11111111-1111-4111-8111-111111111111',
        '55555555-5555-4555-8555-555555555555',
        'CLUB_ADMIN',
        true
      )
    $$
  ),
  '23505',
  'a second active membership for the same club and user is rejected'
);

select is(
  pg_temp.sqlstate_of(
    $$
      insert into public.club_memberships (club_id, user_id, role, active)
      values (
        '11111111-1111-4111-8111-111111111111',
        '66666666-6666-4666-8666-666666666666',
        'COACH',
        true
      )
    $$
  ),
  '23514',
  'club membership role must be CLUB_ADMIN'
);

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;

set local role authenticated;

select is(
  auth.uid(),
  '55555555-5555-4555-8555-555555555555'::uuid,
  'member request subject is the active member'
);
select results_eq(
  $$select id::text from public.clubs order by id$$,
  $$values ('11111111-1111-4111-8111-111111111111')$$,
  'active member can select their club'
);
select results_eq(
  $$select user_id::text from public.profiles order by user_id$$,
  $$values ('55555555-5555-4555-8555-555555555555')$$,
  'active member can select their own profile'
);
select results_eq(
  $$
    select club_id::text, user_id::text, role, active::text
    from public.club_memberships
    order by user_id
  $$,
  $$
    values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      'CLUB_ADMIN',
      'true'
    )
  $$,
  'active member can select their own membership row'
);
select is_empty(
  $$select id from public.clubs where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'active member cannot select a club they do not belong to'
);

select is(
  pg_temp.sqlstate_of(
    $$
      insert into public.clubs (name, slug, timezone, theme_key)
      values ('Denied Club', 'denied-club', 'Australia/Melbourne', 'denied')
    $$
  ),
  '42501',
  'authenticated insert on clubs is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      update public.clubs
      set name = 'Denied'
      where id = '11111111-1111-4111-8111-111111111111'
    $$
  ),
  '42501',
  'authenticated update on clubs is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      delete from public.clubs
      where id = '11111111-1111-4111-8111-111111111111'
    $$
  ),
  '42501',
  'authenticated delete on clubs is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      insert into public.profiles (user_id, display_name, first_name, last_name)
      values (
        '55555555-5555-4555-8555-555555555555',
        'Denied',
        'Denied',
        'Denied'
      )
    $$
  ),
  '42501',
  'authenticated insert on profiles is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      update public.profiles
      set display_name = 'Denied'
      where user_id = '55555555-5555-4555-8555-555555555555'
    $$
  ),
  '42501',
  'authenticated update on profiles is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      delete from public.profiles
      where user_id = '55555555-5555-4555-8555-555555555555'
    $$
  ),
  '42501',
  'authenticated delete on profiles is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      insert into public.club_memberships (club_id, user_id, role)
      values (
        '11111111-1111-4111-8111-111111111111',
        '66666666-6666-4666-8666-666666666666',
        'CLUB_ADMIN'
      )
    $$
  ),
  '42501',
  'authenticated insert on club_memberships is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      update public.club_memberships
      set active = false
      where user_id = '55555555-5555-4555-8555-555555555555'
    $$
  ),
  '42501',
  'authenticated update on club_memberships is denied'
);
select is(
  pg_temp.sqlstate_of(
    $$
      delete from public.club_memberships
      where user_id = '55555555-5555-4555-8555-555555555555'
    $$
  ),
  '42501',
  'authenticated delete on club_memberships is denied'
);

reset role;

do $$
begin
  perform pg_temp.assume_user('66666666-6666-4666-8666-666666666666');
end $$;

set local role authenticated;

select is_empty(
  $$select id from public.clubs$$,
  'outsider select on clubs returns no rows'
);
select is_empty(
  $$select user_id from public.profiles$$,
  'outsider select on profiles returns no rows'
);
select is_empty(
  $$select id from public.club_memberships$$,
  'outsider select on club_memberships returns no rows'
);

reset role;

update public.club_memberships
set active = false
where user_id = '55555555-5555-4555-8555-555555555555';

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;

set local role authenticated;

select is_empty(
  $$select id from public.clubs$$,
  'active = false membership cannot select the club'
);
select is_empty(
  $$select user_id from public.profiles$$,
  'revoked membership select on profiles returns no rows'
);
select is_empty(
  $$select id from public.club_memberships$$,
  'revoked membership select on club_memberships returns no rows'
);

reset role;

set local role anon;

select is(
  pg_temp.sqlstate_of('select id from public.clubs'),
  '42501',
  'anon cannot select clubs'
);

select * from finish();

rollback;
