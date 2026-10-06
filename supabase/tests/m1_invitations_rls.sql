-- Slice 1.5 invitations. Fixtures are policy users, not a sign-in path.

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
    json_build_object('sub', target::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

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
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f', 'authenticated', 'authenticated', 'invite-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1a', 'authenticated', 'authenticated', 'invite-coach@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b', 'authenticated', 'authenticated', 'invite-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1c', 'authenticated', 'authenticated', 'invite-other-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1d', 'authenticated', 'authenticated', 'invite-phone@local.stable.test', '', now(), '{"provider":"phone","providers":["phone"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1e', 'authenticated', 'authenticated', 'invite-unconfirmed@local.stable.test', '', null, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

update auth.users
set phone = '+61400111222', phone_confirmed_at = now()
where id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1d';

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f', 'Invite Admin', 'Invite', 'Admin'),
  ('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1a', 'Invite Coach', 'Invite', 'Coach'),
  ('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b', 'Invite Outsider', 'Invite', 'Outsider'),
  ('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1c', 'Invite Other', 'Invite', 'Other'),
  ('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1d', 'Invite Phone', 'Invite', 'Phone');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Invite Club', 'invite-club', 'Australia/Melbourne', 'mustangs'),
  ('1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b', 'Invite Other', 'invite-other', 'Australia/Melbourne', 'other');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f', 'CLUB_ADMIN', true),
  ('1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1c', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Invite Season'),
  ('1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1d', '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b', 'Other Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c', 'Invite Team', true),
  ('1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1e', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c', 'Invite Inactive', false),
  ('1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d20', '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b', '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1d', 'Other Team', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Synthetic', 'One', true),
  ('1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1f', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Synthetic', 'Two', true),
  ('1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e20', '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', 'Synthetic', 'Idle', false);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a', '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d', '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1a', 'HEAD_COACH', true);

select no_plan();

select has_table('public', 'invitations', 'invitations exists');
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invitations'
      and column_name = 'token'
  ),
  'raw invitation tokens are not stored'
);
select ok(
  pg_temp.sqlstate_of(
    $$insert into public.invitations (
      club_id, player_id, invite_type, intended_email, token_hash, expires_at, created_by
    ) values (
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e',
      'HEAD_COACH',
      'invite-outsider@local.stable.test',
      repeat('a', 64),
      now() + interval '1 day',
      '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'
    )$$
  ) = '23514',
  'a staff invitation cannot target a player'
);

create temp table issued_invites (
  label text primary key,
  invitation_id uuid not null,
  token text not null
);

grant all on table issued_invites to authenticated;

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
set local role authenticated;

insert into issued_invites (label, invitation_id, token)
select 'guardian', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'GUARDIAN',
  null,
  '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e',
  'invite-outsider@local.stable.test',
  null
) as created;

insert into issued_invites (label, invitation_id, token)
select 'coach', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'HEAD_COACH',
  '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d',
  null,
  'invite-outsider@local.stable.test',
  null
) as created;

insert into issued_invites (label, invitation_id, token)
select 'manager', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'TEAM_MANAGER',
  '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d',
  null,
  'invite-outsider@local.stable.test',
  null
) as created;

insert into issued_invites (label, invitation_id, token)
select 'phone', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'ASSISTANT_COACH',
  '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d',
  null,
  null,
  '+61400111222'
) as created;

insert into issued_invites (label, invitation_id, token)
select 'revoke', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'GUARDIAN',
  null,
  '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1f',
  'invite-outsider@local.stable.test',
  null
) as created;

insert into issued_invites (label, invitation_id, token)
select 'expire', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'GUARDIAN',
  null,
  '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e',
  'invite-outsider@local.stable.test',
  null
) as created;

select ok(
  (select token ~ '^[0-9a-f]{64}$' from issued_invites where label = 'guardian'),
  'a created invitation returns a token once'
);
reset role;
select ok(
  not exists (
    select 1
    from public.invitations as invitation
    join issued_invites as issued on issued.invitation_id = invitation.id
    where position(issued.token in invitation.token_hash) > 0
      or invitation.token_hash = issued.token
  ),
  'the stored digest is not the raw token'
);
do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
set local role authenticated;
select ok(
  position(
    (select token from issued_invites where label = 'guardian')
    in (
      select string_agg(listed.id::text || listed.status, ',')
      from public.list_club_invitations('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a') as listed
    )
  ) = 0,
  'the admin list does not return the raw token'
);
select is(
  (
    select status
    from public.list_club_invitations('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a')
    where id = (select invitation_id from issued_invites where label = 'guardian')
  ),
  'pending',
  'a new invitation is pending'
);
select is(
  pg_temp.sqlstate_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'GUARDIAN',
      null,
      '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e20',
      'invite-outsider@local.stable.test',
      null
    )$$
  ),
  '23514',
  'an inactive player cannot be invited'
);
select is(
  pg_temp.sqlstate_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'HEAD_COACH',
      '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1e',
      null,
      'invite-outsider@local.stable.test',
      null
    )$$
  ),
  '23514',
  'an inactive team cannot receive a staff invitation'
);
select is(
  pg_temp.sqlerrm_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'HEAD_COACH',
      '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d20',
      null,
      'invite-outsider@local.stable.test',
      null
    )$$
  ),
  pg_temp.sqlerrm_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'HEAD_COACH',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      null,
      'invite-outsider@local.stable.test',
      null
    )$$
  ),
  'a wrong-club team fails the same way as a missing team'
);

select lives_ok(
  $$select public.revoke_invitation(
    (select invitation_id from issued_invites where label = 'revoke')
  )$$,
  'a club admin revokes a pending invitation'
);
select is(
  (
    select status
    from public.list_club_invitations('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a')
    where id = (select invitation_id from issued_invites where label = 'revoke')
  ),
  'revoked',
  'a revoked invitation stays on record'
);

reset role;
update public.invitations
set expires_at = now() - interval '1 minute'
where id = (select invitation_id from issued_invites where label = 'expire');

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1a'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlstate_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'HEAD_COACH',
      '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d',
      null,
      'invite-outsider@local.stable.test',
      null
    )$$
  ),
  '42501',
  'a coach cannot create an invitation'
);
select is(
  pg_temp.sqlstate_of(
    $$select * from public.invitations$$
  ),
  '42501',
  'a team coach cannot read the invitation table'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1c'); end $$;
select is(
  pg_temp.sqlstate_of(
    $$select public.list_club_invitations('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a')$$
  ),
  '42501',
  'another club admin cannot list these invitations'
);

reset role;
set local role anon;
select is(
  pg_temp.sqlstate_of($$select * from public.invitations$$),
  '42501',
  'anonymous callers cannot read invitations'
);

reset role;
do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'guardian')
    )
  ),
  'IDENTITY_MISMATCH',
  'the wrong confirmed account cannot accept'
);
select ok(
  position(
    'invite-outsider@local.stable.test'
    in pg_temp.sqlerrm_of(
      format(
        'select public.accept_invitation(%L)',
        (select token from issued_invites where label = 'guardian')
      )
    )
  ) = 0,
  'a wrong-identity failure does not reveal the intended email'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1e'); end $$;
select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'guardian')
    )
  ),
  'IDENTITY_MISMATCH',
  'an unconfirmed matching email cannot accept'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'); end $$;
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'guardian')
  ),
  'the intended adult accepts a guardian invitation'
);
select is(
  (
    select count(*)
    from public.guardian_relationships
    where player_id = '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e'
      and user_id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'
      and active
  ),
  1::bigint,
  'acceptance creates one guardian relationship'
);
select is(
  (
    select count(*)
    from public.club_memberships
    where user_id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'
  ),
  0::bigint,
  'a guardian invitation does not create a club role'
);
select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'guardian')
    )
  ),
  'ALREADY_CONSUMED',
  'the same token cannot be consumed twice'
);
reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'invitation.accepted'
      and target_id = (select invitation_id from issued_invites where label = 'guardian')
  ),
  1::bigint,
  'a replay does not write a second acceptance audit'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'); end $$;
set local role authenticated;
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'coach')
  ),
  'the same adult accepts a head coach invitation'
);
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'manager')
  ),
  'the same adult accepts a team manager invitation'
);
select is(
  (
    select count(*)
    from public.team_memberships
    where user_id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'
      and team_id = '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d'
      and active
  ),
  2::bigint,
  'coach and manager invitations grant two roles'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
insert into issued_invites (label, invitation_id, token)
select 'existing', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'HEAD_COACH',
  '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d',
  null,
  'invite-outsider@local.stable.test',
  null
) as created;
insert into issued_invites (label, invitation_id, token)
select 'sibling', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'GUARDIAN',
  null,
  '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1f',
  'invite-outsider@local.stable.test',
  null
) as created;

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'); end $$;
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'existing')
  ),
  'an existing role accepts without a duplicate membership'
);
select is(
  (
    select count(*)
    from public.team_memberships
    where user_id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'
      and role = 'HEAD_COACH'
  ),
  1::bigint,
  'an existing head coach role stays singular'
);
reset role;
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'team_staff.assigned'
      and actor_user_id = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'
  ),
  2::bigint,
  'an already-active role does not add another staff audit'
);
do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'); end $$;
set local role authenticated;
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'sibling')
  ),
  'a guardian can be linked to another player'
);

select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'revoke')
    )
  ),
  'REVOKED',
  'a revoked invitation cannot be accepted'
);
select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'expire')
    )
  ),
  'EXPIRED',
  'an expired invitation cannot be accepted'
);

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1d'); end $$;
select lives_ok(
  format(
    'select public.accept_invitation(%L)',
    (select token from issued_invites where label = 'phone')
  ),
  'a confirmed phone identity accepts a staff invitation'
);

reset role;
update public.players
set active = false
where id = '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e';
update public.teams
set active = false
where id = '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d';

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
set local role authenticated;
insert into issued_invites (label, invitation_id, token)
select 'idle-player', created.id, created.token
from public.create_invitation(
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  'GUARDIAN',
  null,
  '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1f',
  'invite-outsider@local.stable.test',
  null
) as created;

reset role;
update public.players
set active = false
where id = '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1f';

do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1b'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlstate_of(
    format(
      'select public.accept_invitation(%L)',
      (select token from issued_invites where label = 'idle-player')
    )
  ),
  '23514',
  'an inactive player blocks acceptance'
);
do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
select is(
  (
    select listed.consumed_at is null
    from public.list_club_invitations('1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a') as listed
    where listed.id = (select invitation_id from issued_invites where label = 'idle-player')
  ),
  true,
  'a failed acceptance does not consume the invitation'
);

select ok(
  pg_get_functiondef('public.accept_invitation(text)'::regprocedure) ilike '%for update%',
  'acceptance locks the invitation row'
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
create trigger invitation_audit_fail
  before insert on public.audit_events
  for each row
  execute function pg_temp.fail_audit_insert();

reset role;
update public.players
set active = true
where id = '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e';
do $$ begin perform pg_temp.assume_user('1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f'); end $$;
set local role authenticated;
select is(
  pg_temp.sqlstate_of(
    $$select public.create_invitation(
      '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
      'GUARDIAN',
      null,
      '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e',
      'invite-phone@local.stable.test',
      null
    )$$
  ),
  'P0001',
  'invitation creation aborts when the audit insert fails'
);

select * from finish();
rollback;
