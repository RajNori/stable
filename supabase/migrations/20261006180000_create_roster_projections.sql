-- Team roster projections. Names leave the database only in the caller's
-- allowed form. Guardians and staff still have no select on players.

create or replace function public.caller_is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = p_club_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and membership.role = 'CLUB_ADMIN'
  );
$$;

create or replace function public.caller_manages_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = p_team_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and membership.role = 'TEAM_MANAGER'
  );
$$;

create or replace function public.assert_team_roster_reader(
  p_team_id uuid,
  p_full boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not team_row.active then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if public.caller_is_club_admin(team_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = team_row.id
        and membership.club_id = team_row.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role in (
          'HEAD_COACH',
          'ASSISTANT_COACH',
          'TEAM_MANAGER'
        )
    )
  then
    return team_row.club_id;
  end if;

  if p_full then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.guardian_relationships as relationship
    join public.player_team_registrations as registration
      on registration.player_id = relationship.player_id
      and registration.club_id = relationship.club_id
    join public.players as player
      on player.id = relationship.player_id
      and player.club_id = relationship.club_id
    where relationship.user_id = actor
      and relationship.active
      and registration.active
      and registration.team_id = team_row.id
      and player.active
  ) then
    return team_row.club_id;
  end if;

  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.list_team_roster_masked(p_team_id uuid)
returns table (player_id uuid, team_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_team_roster_reader(p_team_id, false);

  return query
  select
    player.id,
    registration.team_id,
    public.player_text(player.first_name)
      || ' '
      || substring(public.player_text(player.last_name) from 1 for 1)
      || '.'
  from public.player_team_registrations as registration
  join public.players as player
    on player.id = registration.player_id
    and player.club_id = registration.club_id
  where registration.team_id = p_team_id
    and registration.active
    and player.active
  order by player.id;
end;
$$;

create or replace function public.list_team_roster_full(p_team_id uuid)
returns table (player_id uuid, team_id uuid, registered_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_team_roster_reader(p_team_id, true);

  return query
  select
    player.id,
    registration.team_id,
    public.player_text(player.first_name)
      || ' '
      || public.player_text(player.last_name)
  from public.player_team_registrations as registration
  join public.players as player
    on player.id = registration.player_id
    and player.club_id = registration.club_id
  where registration.team_id = p_team_id
    and registration.active
    and player.active
  order by player.id;
end;
$$;

create or replace function public.register_player_on_team(
  p_player_id uuid,
  p_team_id uuid
)
returns public.player_team_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
  team_row public.teams;
  current_registration public.player_team_registrations;
  created public.player_team_registrations;
  is_admin boolean;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select player.*
  into existing
  from public.players as player
  where player.id = p_player_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id
    and team.club_id = existing.club_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  is_admin := public.caller_is_club_admin(existing.club_id);
  if not is_admin and not public.caller_manages_team(team_row.id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not existing.active or not team_row.active then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select registration.*
  into current_registration
  from public.player_team_registrations as registration
  where registration.player_id = existing.id
    and registration.active
  for update;

  if found and current_registration.team_id = team_row.id then
    return current_registration;
  end if;

  if found and not is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if found then
    update public.player_team_registrations
    set active = false
    where id = current_registration.id;

    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (
      current_registration.club_id,
      actor,
      'player_team.unregistered',
      current_registration.id
    );
  end if;

  insert into public.player_team_registrations (
    club_id,
    team_id,
    player_id,
    active
  )
  values (existing.club_id, team_row.id, existing.id, true)
  on conflict (team_id, player_id) do update
  set active = true
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (created.club_id, actor, 'player_team.registered', created.id);

  return created;
end;
$$;

create or replace function public.unregister_player_from_team(p_player_id uuid)
returns public.player_team_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.players;
  registration public.player_team_registrations;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select player.*
  into existing
  from public.players as player
  where player.id = p_player_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select row.*
  into registration
  from public.player_team_registrations as row
  where row.player_id = existing.id
    and row.active
  for update;

  if not found then
    select row.*
    into registration
    from public.player_team_registrations as row
    where row.player_id = existing.id
    order by row.updated_at desc
    limit 1;

    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;

    if not public.caller_is_club_admin(existing.club_id)
      and not public.caller_manages_team(registration.team_id)
    then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;

    return registration;
  end if;

  if not public.caller_is_club_admin(existing.club_id)
    and not public.caller_manages_team(registration.team_id)
  then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.player_team_registrations
  set active = false
  where id = registration.id
  returning * into registration;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (
    registration.club_id,
    actor,
    'player_team.unregistered',
    registration.id
  );

  return registration;
end;
$$;

revoke all on function public.caller_is_club_admin(uuid)
  from public, anon, authenticated;
revoke all on function public.caller_manages_team(uuid)
  from public, anon, authenticated;
revoke all on function public.assert_team_roster_reader(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.list_team_roster_masked(uuid)
  from public, anon, authenticated;
revoke all on function public.list_team_roster_full(uuid)
  from public, anon, authenticated;
revoke all on function public.register_player_on_team(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unregister_player_from_team(uuid)
  from public, anon, authenticated;

grant execute on function public.list_team_roster_masked(uuid) to authenticated;
grant execute on function public.list_team_roster_full(uuid) to authenticated;
grant execute on function public.register_player_on_team(uuid, uuid) to authenticated;
grant execute on function public.unregister_player_from_team(uuid) to authenticated;
