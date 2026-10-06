-- Slice 1.3 player and guardian relationships.
-- Classification: additive. No backfill and no destructive change.
-- Full registered child names are permitted only inside authorized Club Admin
-- player-management surfaces. This migration does not store a masked name.
-- Authenticated club admins may select rows for their own club.
-- Writes go through the security-definer functions below.
-- A guardian relationship does not grant select or any capability.

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  first_name text not null,
  last_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_id_club_key unique (id, club_id),
  constraint players_first_name_check check (
    char_length(btrim(first_name)) between 1 and 80
    and first_name = btrim(first_name)
    and first_name !~ '[[:cntrl:]]'
  ),
  constraint players_last_name_check check (
    char_length(btrim(last_name)) between 1 and 80
    and last_name = btrim(last_name)
    and last_name !~ '[[:cntrl:]]'
  )
);

create table public.player_source_identities (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  player_id uuid not null,
  source text not null,
  source_player_id text not null,
  created_at timestamptz not null default now(),
  constraint player_source_identities_source_check check (
    source = 'club_admin_import'
  ),
  constraint player_source_identities_source_player_id_check check (
    char_length(btrim(source_player_id)) between 1 and 80
    and source_player_id = btrim(source_player_id)
    and source_player_id !~ '[[:cntrl:]]'
  ),
  constraint player_source_identities_player_same_club
    foreign key (player_id, club_id)
    references public.players (id, club_id),
  constraint player_source_identities_key
    unique (club_id, source, source_player_id)
);

create table public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  player_id uuid not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_relationships_player_user_key unique (player_id, user_id),
  constraint guardian_relationships_player_same_club
    foreign key (player_id, club_id)
    references public.players (id, club_id)
);

create index players_club_id_idx on public.players (club_id);
create index player_source_identities_club_id_idx
  on public.player_source_identities (club_id);
create index player_source_identities_player_id_idx
  on public.player_source_identities (player_id);
create index guardian_relationships_club_id_idx
  on public.guardian_relationships (club_id);
create index guardian_relationships_player_id_idx
  on public.guardian_relationships (player_id);
create index guardian_relationships_user_id_idx
  on public.guardian_relationships (user_id);

create trigger players_set_updated_at
  before update on public.players
  for each row
  execute function public.set_updated_at();

create trigger guardian_relationships_set_updated_at
  before update on public.guardian_relationships
  for each row
  execute function public.set_updated_at();

alter table public.players enable row level security;
alter table public.player_source_identities enable row level security;
alter table public.guardian_relationships enable row level security;

alter table public.players force row level security;
alter table public.player_source_identities force row level security;
alter table public.guardian_relationships force row level security;

revoke all on table public.players from public, anon, authenticated;
revoke all on table public.player_source_identities from public, anon, authenticated;
revoke all on table public.guardian_relationships from public, anon, authenticated;

grant select on table public.players to authenticated;
grant select on table public.player_source_identities to authenticated;
grant select on table public.guardian_relationships to authenticated;

grant select, insert, update, delete on table public.players to service_role;
grant select, insert, update, delete on table public.player_source_identities to service_role;
grant select, insert, update, delete on table public.guardian_relationships to service_role;

create policy players_select_club_admin
  on public.players
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = players.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

create policy player_source_identities_select_club_admin
  on public.player_source_identities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = player_source_identities.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

create policy guardian_relationships_select_club_admin
  on public.guardian_relationships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = guardian_relationships.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

alter table public.audit_events drop constraint audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'season.created',
      'season.updated',
      'competition.created',
      'competition.updated',
      'team.created',
      'team.updated',
      'venue.created',
      'venue.updated',
      'player.created',
      'player.imported',
      'player.updated',
      'player.deactivated',
      'player.reactivated',
      'guardian.linked',
      'guardian.unlinked'
    )
  );

create or replace function public.player_text(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text;
begin
  if p_value is null or p_value ~ '[[:cntrl:]]' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  trimmed := btrim(p_value);
  if char_length(trimmed) < 1 or char_length(trimmed) > 80 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  return trimmed;
end;
$$;

revoke all on function public.player_text(text) from public, anon, authenticated;

create or replace function public.lock_administered_player(p_player_id uuid)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select player.*
  into existing
  from public.players as player
  where player.id = p_player_id
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = player.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return existing;
end;
$$;

revoke all on function public.lock_administered_player(uuid)
  from public, anon, authenticated;

create or replace function public.create_player(
  p_club_id uuid,
  p_first_name text,
  p_last_name text
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  created public.players;
begin
  insert into public.players (club_id, first_name, last_name)
  values (
    p_club_id,
    public.player_text(p_first_name),
    public.player_text(p_last_name)
  )
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (created.club_id, actor, 'player.created', created.id);

  return created;
end;
$$;

create or replace function public.import_players(p_club_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  item jsonb;
  ordinal integer := 0;
  ok boolean;
  first_name text;
  last_name text;
  source_id text;
  seen text[] := array[]::text[];
  first_names text[] := array[]::text[];
  last_names text[] := array[]::text[];
  source_ids text[] := array[]::text[];
  valid_ordinals integer[] := array[]::integer[];
  invalid integer[] := array[]::integer[];
  sorted_invalid integer[] := array[]::integer[];
  row_index integer;
  earlier integer;
  existing_player uuid;
  created public.players;
  results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 50 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    ordinal := ordinal + 1;
    ok := true;
    first_name := null;
    last_name := null;
    source_id := null;

    if jsonb_typeof(item) is distinct from 'object' then
      ok := false;
    else
      begin
        first_name := public.player_text(item->>'first_name');
        last_name := public.player_text(item->>'last_name');
        source_id := public.player_text(item->>'source_player_id');
      exception
        when sqlstate '23514' then
          ok := false;
      end;
    end if;

    if ok then
      first_names := array_append(first_names, first_name);
      last_names := array_append(last_names, last_name);
      source_ids := array_append(source_ids, source_id);
      valid_ordinals := array_append(valid_ordinals, ordinal);
    else
      invalid := array_append(invalid, ordinal);
    end if;
  end loop;

  for row_index in 1 .. coalesce(cardinality(source_ids), 0)
  loop
    for earlier in 1 .. row_index - 1
    loop
      if source_ids[row_index] = source_ids[earlier] then
        invalid := invalid
          || valid_ordinals[row_index]
          || valid_ordinals[earlier];
      end if;
    end loop;
  end loop;

  if coalesce(cardinality(invalid), 0) > 0 then
    select coalesce(array_agg(row_number order by row_number), array[]::integer[])
    into sorted_invalid
    from (
      select distinct unnest(invalid) as row_number
    ) as rows;

    raise exception 'VALIDATION_FAILED'
      using errcode = '23514', hint = array_to_string(sorted_invalid, ',');
  end if;

  for row_index in 1 .. cardinality(source_ids)
  loop
    select identity.player_id
    into existing_player
    from public.player_source_identities as identity
    where identity.club_id = p_club_id
      and identity.source = 'club_admin_import'
      and identity.source_player_id = source_ids[row_index];

    if found then
      results := results || jsonb_build_array(
        jsonb_build_object(
          'source_player_id', source_ids[row_index],
          'player_id', existing_player,
          'status', 'existing'
        )
      );
    else
      begin
        insert into public.players (club_id, first_name, last_name)
        values (p_club_id, first_names[row_index], last_names[row_index])
        returning * into created;

        insert into public.player_source_identities (
          club_id,
          player_id,
          source,
          source_player_id
        )
        values (
          p_club_id,
          created.id,
          'club_admin_import',
          source_ids[row_index]
        );

        insert into public.audit_events (club_id, actor_user_id, action, target_id)
        values (p_club_id, actor, 'player.imported', created.id);

        results := results || jsonb_build_array(
          jsonb_build_object(
            'source_player_id', source_ids[row_index],
            'player_id', created.id,
            'status', 'created'
          )
        );
      exception
        when unique_violation then
          select identity.player_id
          into existing_player
          from public.player_source_identities as identity
          where identity.club_id = p_club_id
            and identity.source = 'club_admin_import'
            and identity.source_player_id = source_ids[row_index];

          if not found then
            raise;
          end if;

          results := results || jsonb_build_array(
            jsonb_build_object(
              'source_player_id', source_ids[row_index],
              'player_id', existing_player,
              'status', 'existing'
            )
          );
      end;
    end if;
  end loop;

  return results;
end;
$$;

create or replace function public.update_player_identity(
  p_player_id uuid,
  p_first_name text,
  p_last_name text
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
  next_first text;
  next_last text;
begin
  existing := public.lock_administered_player(p_player_id);
  next_first := public.player_text(p_first_name);
  next_last := public.player_text(p_last_name);

  if existing.first_name is distinct from next_first
    or existing.last_name is distinct from next_last then
    update public.players
    set first_name = next_first, last_name = next_last
    where id = existing.id
    returning * into existing;

    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (existing.club_id, actor, 'player.updated', existing.id);
  end if;

  return existing;
end;
$$;

create or replace function public.deactivate_player(p_player_id uuid)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
begin
  existing := public.lock_administered_player(p_player_id);

  if existing.active then
    update public.players
    set active = false
    where id = existing.id
    returning * into existing;

    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (existing.club_id, actor, 'player.deactivated', existing.id);
  end if;

  return existing;
end;
$$;

create or replace function public.reactivate_player(p_player_id uuid)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
begin
  existing := public.lock_administered_player(p_player_id);

  if not existing.active then
    update public.players
    set active = true
    where id = existing.id
    returning * into existing;

    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (existing.club_id, actor, 'player.reactivated', existing.id);
  end if;

  return existing;
end;
$$;

create or replace function public.link_player_guardian(
  p_player_id uuid,
  p_guardian_user_id uuid
)
returns public.guardian_relationships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
  relation public.guardian_relationships;
begin
  existing := public.lock_administered_player(p_player_id);

  if not existing.active then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = existing.club_id
      and membership.user_id = p_guardian_user_id
      and membership.active
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.guardian_relationships (club_id, player_id, user_id, active)
  values (existing.club_id, existing.id, p_guardian_user_id, true)
  on conflict (player_id, user_id) do nothing
  returning * into relation;

  if found then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (existing.club_id, actor, 'guardian.linked', relation.id);
    return relation;
  end if;

  select relationship.*
  into relation
  from public.guardian_relationships as relationship
  where relationship.player_id = existing.id
    and relationship.user_id = p_guardian_user_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if relation.active then
    return relation;
  end if;

  update public.guardian_relationships
  set active = true
  where id = relation.id
  returning * into relation;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'guardian.linked', relation.id);

  return relation;
end;
$$;

create or replace function public.unlink_player_guardian(
  p_player_id uuid,
  p_guardian_user_id uuid
)
returns public.guardian_relationships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
  relation public.guardian_relationships;
begin
  existing := public.lock_administered_player(p_player_id);

  update public.guardian_relationships
  set active = false
  where player_id = existing.id
    and user_id = p_guardian_user_id
    and active
  returning * into relation;

  if found then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (existing.club_id, actor, 'guardian.unlinked', relation.id);
    return relation;
  end if;

  select relationship.*
  into relation
  from public.guardian_relationships as relationship
  where relationship.player_id = existing.id
    and relationship.user_id = p_guardian_user_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return relation;
end;
$$;

create or replace function public.list_club_adults(p_club_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = p_club_id
      and membership.user_id = actor
      and membership.active
      and membership.role = 'CLUB_ADMIN'
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select membership.user_id, profile.display_name
  from public.club_memberships as membership
  join public.profiles as profile
    on profile.user_id = membership.user_id
  where membership.club_id = p_club_id
    and membership.active
  order by profile.display_name, membership.user_id;
end;
$$;

revoke all on function public.create_player(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.import_players(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_player_identity(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.deactivate_player(uuid)
  from public, anon, authenticated;
revoke all on function public.reactivate_player(uuid)
  from public, anon, authenticated;
revoke all on function public.link_player_guardian(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unlink_player_guardian(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.list_club_adults(uuid)
  from public, anon, authenticated;

grant execute on function public.create_player(uuid, text, text) to authenticated;
grant execute on function public.import_players(uuid, jsonb) to authenticated;
grant execute on function public.update_player_identity(uuid, text, text) to authenticated;
grant execute on function public.deactivate_player(uuid) to authenticated;
grant execute on function public.reactivate_player(uuid) to authenticated;
grant execute on function public.link_player_guardian(uuid, uuid) to authenticated;
grant execute on function public.unlink_player_guardian(uuid, uuid) to authenticated;
grant execute on function public.list_club_adults(uuid) to authenticated;
