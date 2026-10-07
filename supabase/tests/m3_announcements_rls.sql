-- Slice 3.1 announcements. Publish, read, acknowledge, and deny.

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
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f01', 'authenticated', 'authenticated', 'announce-admin@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f02', 'authenticated', 'authenticated', 'announce-head@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f03', 'authenticated', 'authenticated', 'announce-assistant@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04', 'authenticated', 'authenticated', 'announce-manager@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05', 'authenticated', 'authenticated', 'announce-guardian@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f06', 'authenticated', 'authenticated', 'announce-outsider@local.stable.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

insert into public.profiles (user_id, display_name, first_name, last_name)
values
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f01', 'Announce Admin', 'Announce', 'Admin'),
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f02', 'Announce Head', 'Announce', 'Head'),
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f03', 'Announce Assistant', 'Announce', 'Assistant'),
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04', 'Announce Manager', 'Announce', 'Manager'),
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05', 'Announce Guardian', 'Announce', 'Guardian'),
  ('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f06', 'Announce Outsider', 'Announce', 'Outsider');

insert into public.clubs (id, name, slug, timezone, theme_key)
values
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', 'Announce Club', 'announce-club', 'Australia/Melbourne', 'mustangs'),
  ('7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b', 'Other Announce Club', 'other-announce-club', 'Australia/Melbourne', 'mustangs');

insert into public.club_memberships (club_id, user_id, role, active)
values
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f01', 'CLUB_ADMIN', true);

insert into public.seasons (id, club_id, name)
values
  ('7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c', '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', 'Announce Season'),
  ('7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7d', '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b', 'Other Season');

insert into public.teams (id, club_id, season_id, name, active)
values
  ('7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c', 'Announce Team', true),
  ('7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7e', '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c', 'Other Team', true),
  ('7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7f', '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b', '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7d', 'Other Club Team', true);

insert into public.team_memberships (club_id, team_id, user_id, role, active)
values
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f02', 'HEAD_COACH', true),
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f03', 'ASSISTANT_COACH', true),
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04', 'TEAM_MANAGER', true);

insert into public.players (id, club_id, first_name, last_name, active)
values
  ('7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e01', '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', 'Own', 'Child', true);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e01', '7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05', true);

insert into public.player_team_registrations (club_id, team_id, player_id, active)
values
  ('7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a', '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', '7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e01', true);

select no_plan();

create temp table issued_announcement (announcement_id uuid);
grant all on table issued_announcement to authenticated;

do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f03'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.publish_announcement(
      '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
      'GENERAL', 'NORMAL', 'Assistant note', 'Not allowed', true
    )
  $sql$),
  'FORBIDDEN',
  'assistant coach cannot publish'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select public.publish_announcement(
      '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
      'GENERAL', 'NORMAL', 'Guardian note', 'Not allowed', true
    )
  $sql$),
  'FORBIDDEN',
  'guardian cannot publish'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04'); end $$;
set local role authenticated;

insert into issued_announcement (announcement_id)
select public.publish_announcement(
  '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
  '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
  'DUTY',
  'IMPORTANT',
  'Canteen reminder',
  'Please arrive early.',
  true
);

reset role;

select is(
  (select count(*) from public.audit_events where action = 'announcement.published'),
  1::bigint,
  'publish writes one audit row'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f06'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select * from public.list_team_announcements(
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', false
    )
  $sql$),
  'FORBIDDEN',
  'outsider cannot list the team'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select * from public.list_team_announcements(
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7e', false
    )
  $sql$),
  'FORBIDDEN',
  'outsider cannot list another team'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05'); end $$;
set local role authenticated;

select is(
  (select title from public.list_team_announcements(
    '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', true
  )),
  'Canteen reminder',
  'guardian reads the team announcement'
);

select is(
  pg_temp.sqlerrm_of($sql$
    select * from public.list_team_announcements(
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7e', false
    )
  $sql$),
  'FORBIDDEN',
  'guardian cannot read another team'
);

select lives_ok(
  $sql$
    select public.acknowledge_announcement(
      (select announcement_id from issued_announcement)
    )
  $sql$,
  'guardian acknowledges once'
);

select lives_ok(
  $sql$
    select public.acknowledge_announcement(
      (select announcement_id from issued_announcement)
    )
  $sql$,
  'acknowledgement is idempotent'
);

reset role;
set local role postgres;

select is(
  (select count(*) from public.audit_events where action = 'announcement.acknowledged'),
  1::bigint,
  'a second acknowledgement does not audit again'
);

select is(
  (select count(*) from public.announcement_acknowledgements),
  1::bigint,
  'acknowledgement stores one adult user'
);

do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04'); end $$;
set local role authenticated;

select lives_ok(
  $sql$
    select public.archive_announcement(
      (select announcement_id from issued_announcement)
    )
  $sql$,
  'manager archives'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05'); end $$;
set local role authenticated;

select is(
  (select count(*) from public.list_team_announcements(
    '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', true
  )),
  0::bigint,
  'a reader does not see an archived announcement'
);

reset role;
do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f04'); end $$;
set local role authenticated;

select is(
  (select count(*) from public.list_announcement_acknowledgements(
    (select announcement_id from issued_announcement)
  )),
  1::bigint,
  'publisher sees acknowledgement progress'
);

reset role;
update public.player_team_registrations
set active = false
where player_id = '7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e01';

do $$ begin perform pg_temp.assume_user('7f7f7f7f-7f7f-47f7-87f7-7f7f7f7f7f05'); end $$;
set local role authenticated;

select is(
  pg_temp.sqlerrm_of($sql$
    select * from public.list_team_announcements(
      '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d', false
    )
  $sql$),
  'FORBIDDEN',
  'a revoked registration cannot read the next announcement'
);

select throws_ok(
  $sql$select * from public.announcements$sql$,
  '42501',
  'permission denied for table announcements',
  'direct announcement reads are denied'
);

select * from finish();
rollback;
