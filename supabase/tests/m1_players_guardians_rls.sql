-- Slice 1.3 player and guardian RLS, constraints, and audited commands.
-- Guardian relationship rows do not grant select. Future staff roles have
-- no policy. Same-club wrong-team denial is still not expressible.

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

create or replace function pg_temp.hint_of(command text)
returns text
language plpgsql
as $$
declare
  hint text;
begin
  execute command;
  return 'OK';
exception
  when others then
    get stacked diagnostics hint = pg_exception_hint;
    return coalesce(hint, '');
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
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'player-admin@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'player-outsider@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '23232323-2323-4232-8232-232323232323',
    'authenticated', 'authenticated', 'player-second@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'player-guardian@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
    'authenticated', 'authenticated', 'player-other-admin@local.stable.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

insert into public.clubs (id, name, slug, timezone, theme_key, active)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Other Club',
  'other-club-players',
  'Australia/Melbourne',
  'other',
  true
);

insert into public.profiles (user_id, display_name, first_name, last_name, locale)
values
  (
    '55555555-5555-4555-8555-555555555555',
    'Policy Admin',
    'Policy',
    'Admin',
    'en-AU'
  ),
  (
    '23232323-2323-4232-8232-232323232323',
    'Second Adult',
    'Second',
    'Adult',
    'en-AU'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Outside Adult',
    'Outside',
    'Adult',
    'en-AU'
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
    '78787878-7878-4787-8787-787878787878',
    '11111111-1111-4111-8111-111111111111',
    '23232323-2323-4232-8232-232323232323',
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

select has_table('public', 'players', 'players table exists');
select has_table('public', 'player_source_identities', 'source identity table exists');
select has_table('public', 'guardian_relationships', 'guardian relationship table exists');
select is_empty(
  $$
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name in (
        'auth_user_id',
        'email',
        'phone',
        'date_of_birth',
        'team_id',
        'display_name',
        'guardian_id'
      )
  $$,
  'players stores no auth, contact, team, or masked-name column'
);
select is_empty(
  $$
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_events'
      and column_name in ('first_name', 'last_name', 'email', 'phone', 'metadata')
  $$,
  'audit events have no child name or contact column'
);

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select set_config(
  'players.one',
  (
    select (public.create_player(
      '11111111-1111-4111-8111-111111111111',
      ' Alexander ',
      ' Robertson '
    )).id::text
  ),
  true
);
select set_config(
  'players.two',
  (
    select (public.create_player(
      '11111111-1111-4111-8111-111111111111',
      'Alexander',
      'Robertson'
    )).id::text
  ),
  true
);

select isnt(
  current_setting('players.one'),
  current_setting('players.two'),
  'same registered name creates a second player id'
);
select is(
  (
    select first_name
    from public.players
    where id = current_setting('players.one')::uuid
  ),
  'Alexander',
  'create stores the trimmed given name'
);
select is(
  (select count(*) from public.players where first_name = 'Alexander' and last_name = 'Robertson'),
  2::bigint,
  'same name does not merge players'
);
select is(
  (
    select actor_user_id::text || '|' || club_id::text || '|' || action || '|' || target_id::text
    from public.audit_events
    where action = 'player.created'
      and target_id = current_setting('players.one')::uuid
  ),
  '55555555-5555-4555-8555-555555555555|11111111-1111-4111-8111-111111111111|player.created|' || current_setting('players.one'),
  'player create audits actor, club, action, and target'
);
select is(
  (
    select created_at
    from public.audit_events
    where action = 'player.created'
      and target_id = current_setting('players.one')::uuid
  ),
  now(),
  'player create audit timestamp is the database transaction time'
);
select ok(
  not exists (
    select 1
    from public.audit_events
    where action like '%Alexander%'
      or action like '%Robertson%'
  ),
  'audit actions do not contain a child name'
);
select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    E'Alexander\n',
    'Robertson'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'control characters are rejected'
);
select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    repeat('A', 81),
    'Robertson'
  )$$,
  '23514',
  'VALIDATION_FAILED',
  'names longer than 80 characters are rejected'
);

select is(
  pg_temp.sqlstate_of(
    $$insert into public.players (club_id, first_name, last_name)
      values ('11111111-1111-4111-8111-111111111111', 'Direct', 'Write')$$
  ),
  '42501',
  'club admin cannot insert players directly'
);
select is(
  pg_temp.sqlstate_of($$update public.players set first_name = first_name$$),
  '42501',
  'club admin cannot update players directly'
);
select is(
  pg_temp.sqlstate_of('delete from public.players'),
  '42501',
  'club admin cannot delete players'
);
select is(
  pg_temp.sqlstate_of(
    $$insert into public.guardian_relationships (club_id, player_id, user_id)
      values (
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        '55555555-5555-4555-8555-555555555555'
      )$$
  ),
  '42501',
  'club admin cannot insert guardian relationships directly'
);
select is(
  pg_temp.sqlstate_of('update public.guardian_relationships set active = active'),
  '42501',
  'club admin cannot update guardian relationships directly'
);
select is(
  pg_temp.sqlstate_of('delete from public.guardian_relationships'),
  '42501',
  'club admin cannot delete guardian relationships'
);
select is(
  pg_temp.sqlstate_of(
    $$insert into public.player_source_identities (club_id, player_id, source, source_player_id)
      values (
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'club_admin_import',
        'direct'
      )$$
  ),
  '42501',
  'club admin cannot insert source identities directly'
);
select is(
  pg_temp.sqlstate_of('update public.player_source_identities set source = source'),
  '42501',
  'club admin cannot update source identities directly'
);
select is(
  pg_temp.sqlstate_of('delete from public.player_source_identities'),
  '42501',
  'club admin cannot delete source identities'
);

select set_config(
  'players.import',
  public.import_players(
    '11111111-1111-4111-8111-111111111111',
    '[
      {"first_name":"Jordan","last_name":"Lee","source_player_id":"import-1"},
      {"first_name":"Jordan","last_name":"Lee","source_player_id":"import-2"}
    ]'::jsonb
  )::text,
  true
);
select is(
  (
    select count(*)
    from jsonb_array_elements(current_setting('players.import')::jsonb) as item
    where item->>'status' = 'created'
  ),
  2::bigint,
  'import creates one player per new source id'
);
select is(
  (
    select count(*)
    from public.players
    where first_name = 'Jordan' and last_name = 'Lee'
  ),
  2::bigint,
  'identical imported names stay separate players'
);
select set_config(
  'players.import_one',
  (
    select item->>'player_id'
    from jsonb_array_elements(current_setting('players.import')::jsonb) as item
    where item->>'source_player_id' = 'import-1'
  ),
  true
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.imported'
      and target_id = current_setting('players.import_one')::uuid
      and actor_user_id = '55555555-5555-4555-8555-555555555555'
      and club_id = '11111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'import audits the new player once'
);
select is(
  (
    select item->>'status'
    from jsonb_array_elements(
      public.import_players(
        '11111111-1111-4111-8111-111111111111',
        '[{"first_name":"Changed","last_name":"Name","source_player_id":"import-1"}]'::jsonb
      )
    ) as item
  ),
  'existing',
  'repeated source id returns the existing player'
);
select is(
  (
    select first_name
    from public.players
    where id = current_setting('players.import_one')::uuid
  ),
  'Jordan',
  'import retry does not rename the player'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.imported'
      and target_id = current_setting('players.import_one')::uuid
  ),
  1::bigint,
  'import retry does not write another audit row'
);
select is(
  pg_temp.hint_of(
    $$select public.import_players(
      '11111111-1111-4111-8111-111111111111',
      '[
        {"first_name":"Ok","last_name":"Name","source_player_id":"import-3"},
        {"first_name":" ","last_name":"Name","source_player_id":"import-4"}
      ]'::jsonb
    )$$
  ),
  '2',
  'invalid import identifies the row number only'
);
select is_empty(
  $$select id from public.player_source_identities where source_player_id in ('import-3', 'import-4')$$,
  'invalid import writes nothing'
);
select is(
  pg_temp.hint_of(
    $$select public.import_players(
      '11111111-1111-4111-8111-111111111111',
      '[
        {"first_name":"Ok","last_name":"Name","source_player_id":"import-5"},
        {"first_name":"Ok","last_name":"Name","source_player_id":"import-5"}
      ]'::jsonb
    )$$
  ),
  '1,2',
  'duplicate source ids in one batch are rejected together'
);
select is_empty(
  $$select id from public.player_source_identities where source_player_id = 'import-5'$$,
  'duplicate source batch writes nothing'
);
select throws_ok(
  format(
    'select public.import_players(%L, %L::jsonb)',
    '11111111-1111-4111-8111-111111111111',
    (
      select jsonb_agg(
        jsonb_build_object(
          'first_name', 'Ada',
          'last_name', 'Batch',
          'source_player_id', 'row-' || gs
        )
      )::text
      from generate_series(1, 51) as gs
    )
  ),
  '23514',
  'VALIDATION_FAILED',
  'import rejects more than 50 rows'
);

select lives_ok(
  format(
    'select public.update_player_identity(%L, %L, %L)',
    current_setting('players.one'),
    'Alexandra',
    'Robertson'
  ),
  'club admin can correct a player name'
);
select is(
  (
    select first_name
    from public.players
    where id = current_setting('players.one')::uuid
  ),
  'Alexandra',
  'name correction keeps the same player id'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.updated'
      and target_id = current_setting('players.one')::uuid
  ),
  1::bigint,
  'name correction writes one update audit'
);
select lives_ok(
  format(
    'select public.update_player_identity(%L, %L, %L)',
    current_setting('players.one'),
    'Alexandra',
    'Robertson'
  ),
  'repeating the same name succeeds'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.updated'
      and target_id = current_setting('players.one')::uuid
  ),
  1::bigint,
  'unchanged name does not write another audit row'
);

select set_config(
  'players.link',
  (
    select (public.link_player_guardian(
      current_setting('players.one')::uuid,
      '55555555-5555-4555-8555-555555555555'
    )).id::text
  ),
  true
);
select set_config(
  'players.link_two',
  (
    select (public.link_player_guardian(
      current_setting('players.one')::uuid,
      '23232323-2323-4232-8232-232323232323'
    )).id::text
  ),
  true
);
select set_config(
  'players.sibling',
  (
    select (public.link_player_guardian(
      current_setting('players.two')::uuid,
      '55555555-5555-4555-8555-555555555555'
    )).id::text
  ),
  true
);
select is(
  (
    select count(*)
    from public.guardian_relationships
    where player_id = current_setting('players.one')::uuid
      and active
  ),
  2::bigint,
  'one player can have two guardians'
);
select is(
  (
    select count(*)
    from public.guardian_relationships
    where user_id = '55555555-5555-4555-8555-555555555555'
      and active
  ),
  2::bigint,
  'one guardian can be linked to two players'
);
select is(
  (
    select target_id::text
    from public.audit_events
    where action = 'guardian.linked'
      and target_id = current_setting('players.link')::uuid
  ),
  current_setting('players.link'),
  'guardian link audits the relationship id'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'guardian.linked'
      and target_id = current_setting('players.link')::uuid
  ),
  1::bigint,
  'the first link writes one audit row'
);
select lives_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '55555555-5555-4555-8555-555555555555'
  ),
  'linking the same guardian again succeeds'
);
select is(
  (
    select count(*)
    from public.guardian_relationships
    where player_id = current_setting('players.one')::uuid
      and user_id = '55555555-5555-4555-8555-555555555555'
  ),
  1::bigint,
  'a repeated link does not create a second row'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'guardian.linked'
      and target_id = current_setting('players.link')::uuid
  ),
  1::bigint,
  'a repeated active link does not write another audit row'
);

select lives_ok(
  format(
    'select public.unlink_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '23232323-2323-4232-8232-232323232323'
  ),
  'club admin can unlink a guardian'
);
select is(
  (
    select active
    from public.guardian_relationships
    where id = current_setting('players.link_two')::uuid
  ),
  false,
  'unlink deactivates the relationship'
);
select lives_ok(
  format(
    'select public.unlink_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '23232323-2323-4232-8232-232323232323'
  ),
  'repeating an unlink succeeds'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'guardian.unlinked'
      and target_id = current_setting('players.link_two')::uuid
  ),
  1::bigint,
  'repeating an unlink does not write another audit row'
);
select lives_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '23232323-2323-4232-8232-232323232323'
  ),
  'linking again reactivates the same relationship'
);
select is(
  (
    select active
    from public.guardian_relationships
    where id = current_setting('players.link_two')::uuid
  ),
  true,
  'relink keeps the same relationship id'
);

select lives_ok(
  format(
    'select public.deactivate_player(%L::uuid)',
    current_setting('players.two')
  ),
  'club admin can deactivate a player'
);
select is(
  (
    select active
    from public.players
    where id = current_setting('players.two')::uuid
  ),
  false,
  'deactivation keeps the player id and marks it inactive'
);
select is(
  (
    select count(*)
    from public.guardian_relationships
    where player_id = current_setting('players.two')::uuid
  ),
  1::bigint,
  'deactivation keeps existing guardian relationships'
);
select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.two'),
    '23232323-2323-4232-8232-232323232323'
  ),
  '23514',
  'VALIDATION_FAILED',
  'a new link to an inactive player is refused'
);
select lives_ok(
  format(
    'select public.deactivate_player(%L::uuid)',
    current_setting('players.two')
  ),
  'repeating deactivation succeeds'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.deactivated'
      and target_id = current_setting('players.two')::uuid
  ),
  1::bigint,
  'repeating deactivation does not write another audit row'
);
select lives_ok(
  format(
    'select public.reactivate_player(%L::uuid)',
    current_setting('players.two')
  ),
  'club admin can reactivate a player'
);
select is(
  (
    select id::text
    from public.players
    where id = current_setting('players.two')::uuid
      and active
  ),
  current_setting('players.two'),
  'reactivation keeps the same player id'
);
select lives_ok(
  format(
    'select public.reactivate_player(%L::uuid)',
    current_setting('players.two')
  ),
  'repeating reactivation succeeds'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'player.reactivated'
      and target_id = current_setting('players.two')::uuid
  ),
  1::bigint,
  'repeating reactivation does not write another audit row'
);

select results_eq(
  $$select user_id::text from public.list_club_adults('11111111-1111-4111-8111-111111111111') order by 1$$,
  $$values ('23232323-2323-4232-8232-232323232323'), ('55555555-5555-4555-8555-555555555555')$$,
  'adult list contains only active members of this club'
);
select is(
  (
    select display_name
    from public.list_club_adults('11111111-1111-4111-8111-111111111111')
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  'Policy Admin',
  'adult list returns the adult display name'
);

reset role;

select is(
  pg_temp.sqlstate_of(
    $$insert into public.guardian_relationships (club_id, player_id, user_id)
      values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        (select id from public.players where first_name = 'Alexandra' limit 1),
        'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc'
      )$$
  ),
  '23503',
  'a relationship cannot point at a player in another club'
);
select is(
  pg_temp.sqlstate_of(
    $$insert into public.player_source_identities (club_id, player_id, source, source_player_id)
      values (
        '11111111-1111-4111-8111-111111111111',
        (select id from public.players where first_name = 'Jordan' limit 1),
        'playhq',
        'external-1'
      )$$
  ),
  '23514',
  'playhq is not a source in this slice'
);

insert into public.guardian_relationships (club_id, player_id, user_id, active)
values (
  '11111111-1111-4111-8111-111111111111',
  (select id from public.players where first_name = 'Alexandra' limit 1),
  '44444444-4444-4444-8444-444444444444',
  true
);

do $$
begin
  perform pg_temp.assume_user('66666666-6666-4666-8666-666666666666');
end $$;
set local role authenticated;

select is_empty($$select id from public.players$$, 'outsider cannot select players');
select is_empty(
  $$select id from public.guardian_relationships$$,
  'outsider cannot select guardian relationships'
);
select is_empty(
  $$select id from public.player_source_identities$$,
  'outsider cannot select source identities'
);
select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    'Nope',
    'Child'
  )$$,
  '42501',
  'FORBIDDEN',
  'outsider cannot create a player'
);
select throws_ok(
  format(
    'select public.update_player_identity(%L::uuid, %L, %L)',
    current_setting('players.one'),
    'Nope',
    'Child'
  ),
  'P0002',
  'NOT_FOUND',
  'outsider update looks the same as a missing player'
);
select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '66666666-6666-4666-8666-666666666666'
  ),
  'P0002',
  'NOT_FOUND',
  'an adult cannot self-link by knowing a player id'
);
select throws_ok(
  $$select public.import_players(
    '11111111-1111-4111-8111-111111111111',
    '[{"first_name":"Nope","last_name":"Child","source_player_id":"import-x"}]'::jsonb
  )$$,
  '42501',
  'FORBIDDEN',
  'outsider cannot import into this club'
);
select throws_ok(
  $$select user_id from public.list_club_adults('11111111-1111-4111-8111-111111111111')$$,
  'P0002',
  'NOT_FOUND',
  'outsider cannot list club adults'
);

reset role;
do $$
begin
  perform pg_temp.assume_user('44444444-4444-4444-8444-444444444444');
end $$;
set local role authenticated;

select is_empty(
  $$select id from public.players$$,
  'a linked guardian without club admin membership cannot select players'
);
select is_empty(
  $$select id from public.guardian_relationships$$,
  'a linked guardian cannot select relationships'
);
select throws_ok(
  format(
    'select public.deactivate_player(%L::uuid)',
    current_setting('players.one')
  ),
  'P0002',
  'NOT_FOUND',
  'a linked guardian cannot deactivate a player'
);

reset role;
do $$
begin
  perform pg_temp.assume_user('bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc');
end $$;
set local role authenticated;

select is_empty(
  $$select id from public.players where club_id = '11111111-1111-4111-8111-111111111111'$$,
  'other-club admin cannot select these players'
);
select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    'Other',
    'Child'
  )$$,
  '42501',
  'FORBIDDEN',
  'other-club admin cannot create a player in this club'
);
select throws_ok(
  format(
    'select public.update_player_identity(%L::uuid, %L, %L)',
    current_setting('players.one'),
    'Other',
    'Child'
  ),
  'P0002',
  'NOT_FOUND',
  'other-club update does not reveal the player'
);
select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc'
  ),
  'P0002',
  'NOT_FOUND',
  'other-club link does not reveal the player'
);
select throws_ok(
  $$select user_id from public.list_club_adults('11111111-1111-4111-8111-111111111111')$$,
  'P0002',
  'NOT_FOUND',
  'other-club admin cannot list this club adults'
);
select is(
  pg_temp.sqlerrm_of(
    format(
      'select public.deactivate_player(%L::uuid)',
      'abababab-abab-4aba-8aba-abababababab'
    )
  ),
  pg_temp.sqlerrm_of(
    format(
      'select public.deactivate_player(%L::uuid)',
      current_setting('players.one')
    )
  ),
  'missing and other-club player ids fail the same way'
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

select is_empty($$select id from public.players$$, 'revoked admin cannot select players');
select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    'Revoked',
    'Child'
  )$$,
  '42501',
  'FORBIDDEN',
  'revoked admin cannot create a player'
);
select throws_ok(
  format(
    'select public.reactivate_player(%L::uuid)',
    current_setting('players.two')
  ),
  'P0002',
  'NOT_FOUND',
  'revoked admin cannot reactivate a player'
);
select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.one'),
    '23232323-2323-4232-8232-232323232323'
  ),
  'P0002',
  'NOT_FOUND',
  'revoked admin cannot link a guardian'
);

reset role;
update public.club_memberships
set active = false
where user_id = '23232323-2323-4232-8232-232323232323';
update public.club_memberships
set active = true
where id = '77777777-7777-4777-8777-777777777777';

do $$
begin
  perform pg_temp.assume_user('55555555-5555-4555-8555-555555555555');
end $$;
set local role authenticated;

select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.two'),
    '23232323-2323-4232-8232-232323232323'
  ),
  'P0002',
  'NOT_FOUND',
  'a revoked club adult cannot be linked'
);
select throws_ok(
  format(
    'select public.link_player_guardian(%L::uuid, %L::uuid)',
    current_setting('players.two'),
    '66666666-6666-4666-8666-666666666666'
  ),
  'P0002',
  'NOT_FOUND',
  'an unknown or non-member adult cannot be linked'
);
select throws_ok(
  $$select public.update_player_identity(
    'abababab-abab-4aba-8aba-abababababab',
    'Missing',
    'Child'
  )$$,
  'P0002',
  'NOT_FOUND',
  'a missing player id is not found'
);

reset role;

select is(
  p.proargnames,
  expected_args,
  format('%s does not accept an actor id', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
join (
  values
    ('create_player', array['p_club_id', 'p_first_name', 'p_last_name']),
    ('import_players', array['p_club_id', 'p_rows']),
    ('update_player_identity', array['p_player_id', 'p_first_name', 'p_last_name']),
    ('deactivate_player', array['p_player_id']),
    ('reactivate_player', array['p_player_id']),
    ('link_player_guardian', array['p_player_id', 'p_guardian_user_id']),
    ('unlink_player_guardian', array['p_player_id', 'p_guardian_user_id']),
    ('list_club_adults', array['p_club_id', 'user_id', 'display_name'])
) as expected(function_name, expected_args)
  on expected.function_name = p.proname
where n.nspname = 'public';

select is(
  pg_get_function_result(p.oid),
  'TABLE(user_id uuid, display_name text)',
  'list_club_adults returns user id and display name only'
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'list_club_adults';

select ok(
  pg_get_functiondef('public.list_club_adults(uuid)'::regprocedure) not like '%email%'
    and pg_get_functiondef('public.list_club_adults(uuid)'::regprocedure) not like '%phone%',
  'list_club_adults does not read email or phone'
);

select ok(
  p.prosecdef
    and (
      p.proconfig @> array['search_path=']
      or p.proconfig @> array['search_path=""']
    )
    and p.proacl is not null
    and not exists (
      select 1
      from aclexplode(p.proacl) as acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    )
    and not has_function_privilege('anon', p.oid, 'execute')
    and has_function_privilege('authenticated', p.oid, 'execute'),
  format('authenticated alone can execute %s', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_player',
    'import_players',
    'update_player_identity',
    'deactivate_player',
    'reactivate_player',
    'link_player_guardian',
    'unlink_player_guardian',
    'list_club_adults'
  );

select ok(
  (
    p.proconfig @> array['search_path=']
    or p.proconfig @> array['search_path=""']
  )
    and not has_function_privilege('anon', p.oid, 'execute')
    and not has_function_privilege('authenticated', p.oid, 'execute'),
  format('clients cannot execute %s', p.proname)
)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('player_text', 'lock_administered_player');

create or replace function pg_temp.fail_audit_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit insert forced to fail';
end;
$$;

create trigger players_audit_fail
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
    'players.audit_count',
    (select count(*)::text from public.audit_events),
    true
  );
  perform set_config(
    'players.row_count',
    (select count(*)::text from public.players),
    true
  );
end $$;

select is(
  pg_temp.sqlstate_of(
    $$select public.create_player(
      '11111111-1111-4111-8111-111111111111',
      'Atomic',
      'Child'
    )$$
  ),
  'P0001',
  'player create aborts when the audit insert fails'
);
select is_empty(
  $$select id from public.players where first_name = 'Atomic'$$,
  'failed player audit leaves no player'
);
select is(
  pg_temp.sqlstate_of(
    $$select public.import_players(
      '11111111-1111-4111-8111-111111111111',
      '[{"first_name":"Atomic","last_name":"Import","source_player_id":"atomic-import"}]'::jsonb
    )$$
  ),
  'P0001',
  'import aborts when the audit insert fails'
);
select is_empty(
  $$select id from public.player_source_identities where source_player_id = 'atomic-import'$$,
  'failed import audit leaves no source identity'
);
select is(
  (select count(*)::text from public.players),
  current_setting('players.row_count'),
  'failed audit leaves the player count unchanged'
);
select is(
  (select count(*)::text from public.audit_events),
  current_setting('players.audit_count'),
  'failed audit leaves no audit row'
);

reset role;
drop trigger players_audit_fail on public.audit_events;
drop function pg_temp.fail_audit_insert();

do $$
begin
  perform pg_temp.clear_user();
end $$;
set local role authenticated;

select throws_ok(
  $$select public.create_player(
    '11111111-1111-4111-8111-111111111111',
    'No',
    'Session'
  )$$,
  '28000',
  'UNAUTHENTICATED',
  'a session without an actor cannot create a player'
);

set local role anon;

select is(
  pg_temp.sqlstate_of('select id from public.players'),
  '42501',
  'anon cannot select players'
);
select is(
  pg_temp.sqlstate_of('select id from public.guardian_relationships'),
  '42501',
  'anon cannot select guardian relationships'
);
select is(
  pg_temp.sqlstate_of('select id from public.player_source_identities'),
  '42501',
  'anon cannot select source identities'
);
select is(
  pg_temp.sqlstate_of(statement),
  '42501',
  description
)
from (
  values
    (
      $$select public.create_player('11111111-1111-4111-8111-111111111111', 'Anon', 'Child')$$,
      'anon cannot execute create_player'
    ),
    (
      $$select public.import_players('11111111-1111-4111-8111-111111111111', '[]'::jsonb)$$,
      'anon cannot execute import_players'
    ),
    (
      $$select public.update_player_identity('11111111-1111-4111-8111-111111111111', 'Anon', 'Child')$$,
      'anon cannot execute update_player_identity'
    ),
    (
      $$select public.deactivate_player('11111111-1111-4111-8111-111111111111')$$,
      'anon cannot execute deactivate_player'
    ),
    (
      $$select public.reactivate_player('11111111-1111-4111-8111-111111111111')$$,
      'anon cannot execute reactivate_player'
    ),
    (
      $$select public.link_player_guardian('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555')$$,
      'anon cannot execute link_player_guardian'
    ),
    (
      $$select public.unlink_player_guardian('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555')$$,
      'anon cannot execute unlink_player_guardian'
    ),
    (
      $$select * from public.list_club_adults('11111111-1111-4111-8111-111111111111')$$,
      'anon cannot execute list_club_adults'
    )
) as anon_calls(statement, description);
select is(
  pg_temp.sqlstate_of(statement),
  '42501',
  description
)
from (
  values
    ('insert into public.players default values', 'anon cannot insert players'),
    ('update public.players set first_name = first_name', 'anon cannot update players'),
    ('delete from public.players', 'anon cannot delete players'),
    ('insert into public.guardian_relationships default values', 'anon cannot insert guardian relationships'),
    ('update public.guardian_relationships set active = active', 'anon cannot update guardian relationships'),
    ('delete from public.guardian_relationships', 'anon cannot delete guardian relationships'),
    ('insert into public.player_source_identities default values', 'anon cannot insert source identities'),
    ('update public.player_source_identities set source = source', 'anon cannot update source identities'),
    ('delete from public.player_source_identities', 'anon cannot delete source identities')
) as anon_writes(statement, description);

select * from finish();

rollback;
