-- Slice 1.4 membership and capabilities.
-- Classification: additive. No backfill and no destructive change.
-- Club admin stays on club_memberships. Team staff and player registration
-- are separate relations. Guardian access is not a staff role.
-- Authenticated clients may select only through the policies below.
-- Writes go through the security-definer functions below.

alter table public.teams
  add constraint teams_id_club_key unique (id, club_id);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_memberships_role_check check (
    role in ('HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER')
  ),
  constraint team_memberships_team_same_club foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint team_memberships_role_key unique (team_id, user_id, role)
);

create table public.player_team_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  player_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_team_registrations_team_same_club
    foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint player_team_registrations_player_same_club
    foreign key (player_id, club_id)
    references public.players (id, club_id),
  constraint player_team_registrations_team_player_key unique (team_id, player_id)
);

create unique index player_team_registrations_one_active_per_player
  on public.player_team_registrations (player_id)
  where active;

create index team_memberships_club_id_idx
  on public.team_memberships (club_id);
create index team_memberships_team_id_idx
  on public.team_memberships (team_id);
create index team_memberships_user_id_idx
  on public.team_memberships (user_id);
create index player_team_registrations_club_id_idx
  on public.player_team_registrations (club_id);
create index player_team_registrations_team_id_idx
  on public.player_team_registrations (team_id);
create index player_team_registrations_player_id_idx
  on public.player_team_registrations (player_id);

create trigger team_memberships_set_updated_at
  before update on public.team_memberships
  for each row
  execute function public.set_updated_at();

create trigger player_team_registrations_set_updated_at
  before update on public.player_team_registrations
  for each row
  execute function public.set_updated_at();

alter table public.team_memberships enable row level security;
alter table public.player_team_registrations enable row level security;
alter table public.team_memberships force row level security;
alter table public.player_team_registrations force row level security;

revoke all on table public.team_memberships from public, anon, authenticated;
revoke all on table public.player_team_registrations from public, anon, authenticated;
grant select on table public.team_memberships to authenticated;
grant select on table public.player_team_registrations to authenticated;
grant select, insert, update, delete on table public.team_memberships to service_role;
grant select, insert, update, delete on table public.player_team_registrations to service_role;

-- Boolean helpers are security definer so policies can see active players
-- without granting guardians select on child names. Authenticated may execute
-- them because a policy runs as the invoker. They return only true or false.
create or replace function public.player_is_active(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select player.active
    from public.players as player
    where player.id = p_player_id
  ), false);
$$;

create or replace function public.team_is_active(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select team.active
    from public.teams as team
    where team.id = p_team_id
  ), false);
$$;

create or replace function public.caller_guards_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_relationships as relationship
    where relationship.user_id = (select auth.uid())
      and relationship.player_id = p_player_id
      and relationship.active
  )
  and public.player_is_active(p_player_id);
$$;

revoke all on function public.player_is_active(uuid) from public, anon;
revoke all on function public.team_is_active(uuid) from public, anon;
revoke all on function public.caller_guards_player(uuid) from public, anon;
grant execute on function public.player_is_active(uuid) to authenticated;
grant execute on function public.team_is_active(uuid) to authenticated;
grant execute on function public.caller_guards_player(uuid) to authenticated;

create policy team_memberships_select_own
  on public.team_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and active
  );

create policy team_memberships_select_club_admin
  on public.team_memberships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = team_memberships.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

create policy player_team_registrations_select_club_admin
  on public.player_team_registrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = player_team_registrations.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

create policy player_team_registrations_select_guardian
  on public.player_team_registrations
  for select
  to authenticated
  using (public.caller_guards_player(player_id));

create policy guardian_relationships_select_own
  on public.guardian_relationships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and active
  );

drop policy teams_select_active_member on public.teams;

create policy teams_select_club_admin
  on public.teams
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = teams.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    )
  );

create policy teams_select_staff
  on public.teams
  for select
  to authenticated
  using (
    active
    and exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = teams.id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create policy teams_select_guardian
  on public.teams
  for select
  to authenticated
  using (
    active
    and exists (
      select 1
      from public.player_team_registrations as registration
      where registration.team_id = teams.id
        and registration.active
        and public.caller_guards_player(registration.player_id)
    )
  );

drop policy clubs_select_active_member on public.clubs;

create policy clubs_select_active_member
  on public.clubs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = clubs.id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.club_id = clubs.id
        and membership.user_id = (select auth.uid())
        and membership.active
        and public.team_is_active(membership.team_id)
    )
    or exists (
      select 1
      from public.player_team_registrations as registration
      where registration.club_id = clubs.id
        and registration.active
        and public.team_is_active(registration.team_id)
        and public.caller_guards_player(registration.player_id)
    )
  );

drop policy profiles_select_own_active_member on public.profiles;

create policy profiles_select_own_active_member
  on public.profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.club_memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.active
      )
      or exists (
        select 1
        from public.team_memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.active
          and public.team_is_active(membership.team_id)
      )
      or exists (
        select 1
        from public.player_team_registrations as registration
        join public.guardian_relationships as relationship
          on relationship.player_id = registration.player_id
        where relationship.user_id = (select auth.uid())
          and relationship.active
          and registration.active
          and public.player_is_active(registration.player_id)
          and public.team_is_active(registration.team_id)
      )
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
      'guardian.unlinked',
      'team_staff.assigned',
      'team_staff.revoked',
      'team_staff.reactivated',
      'player_team.registered',
      'player_team.unregistered'
    )
  );

create or replace function public.assign_team_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.team_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  team_row public.teams;
  membership public.team_memberships;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if p_role not in ('HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select team.*
  into team_row
  from public.teams as team
  where team.id = p_team_id
    and exists (
      select 1
      from public.club_memberships as admin_membership
      where admin_membership.club_id = team.club_id
        and admin_membership.user_id = actor
        and admin_membership.active
        and admin_membership.role = 'CLUB_ADMIN'
    )
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not team_row.active then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.club_memberships as target
    where target.club_id = team_row.club_id
      and target.user_id = p_user_id
      and target.active
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.team_memberships (club_id, team_id, user_id, role, active)
  values (team_row.club_id, team_row.id, p_user_id, p_role, true)
  on conflict (team_id, user_id, role) do nothing
  returning * into membership;

  if found then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (team_row.club_id, actor, 'team_staff.assigned', membership.id);
    return membership;
  end if;

  select row.*
  into membership
  from public.team_memberships as row
  where row.team_id = team_row.id
    and row.user_id = p_user_id
    and row.role = p_role
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if membership.active then
    return membership;
  end if;

  update public.team_memberships
  set active = true
  where id = membership.id
  returning * into membership;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (team_row.club_id, actor, 'team_staff.assigned', membership.id);

  return membership;
end;
$$;

create or replace function public.revoke_team_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.team_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  membership public.team_memberships;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select row.*
  into membership
  from public.team_memberships as row
  where row.team_id = p_team_id
    and row.user_id = p_user_id
    and row.role = p_role
    and exists (
      select 1
      from public.club_memberships as admin_membership
      where admin_membership.club_id = row.club_id
        and admin_membership.user_id = actor
        and admin_membership.active
        and admin_membership.role = 'CLUB_ADMIN'
    )
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not membership.active then
    return membership;
  end if;

  update public.team_memberships
  set active = false
  where id = membership.id
  returning * into membership;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (membership.club_id, actor, 'team_staff.revoked', membership.id);

  return membership;
end;
$$;

create or replace function public.reactivate_team_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.team_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  membership public.team_memberships;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.team_is_active(p_team_id) then
    if not exists (
      select 1
      from public.teams as team
      where team.id = p_team_id
        and exists (
          select 1
          from public.club_memberships as admin_membership
          where admin_membership.club_id = team.club_id
            and admin_membership.user_id = actor
            and admin_membership.active
            and admin_membership.role = 'CLUB_ADMIN'
        )
    ) then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select row.*
  into membership
  from public.team_memberships as row
  where row.team_id = p_team_id
    and row.user_id = p_user_id
    and row.role = p_role
    and exists (
      select 1
      from public.club_memberships as admin_membership
      where admin_membership.club_id = row.club_id
        and admin_membership.user_id = actor
        and admin_membership.active
        and admin_membership.role = 'CLUB_ADMIN'
    )
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if membership.active then
    return membership;
  end if;

  update public.team_memberships
  set active = true
  where id = membership.id
  returning * into membership;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (membership.club_id, actor, 'team_staff.reactivated', membership.id);

  return membership;
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
begin
  existing := public.lock_administered_player(p_player_id);

  if not existing.active then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
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

  if not team_row.active then
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
  existing := public.lock_administered_player(p_player_id);

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

    return registration;
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

revoke all on function public.assign_team_role(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_team_role(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reactivate_team_role(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.register_player_on_team(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unregister_player_from_team(uuid)
  from public, anon, authenticated;

grant execute on function public.assign_team_role(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_team_role(uuid, uuid, text) to authenticated;
grant execute on function public.reactivate_team_role(uuid, uuid, text) to authenticated;
grant execute on function public.register_player_on_team(uuid, uuid) to authenticated;
grant execute on function public.unregister_player_from_team(uuid) to authenticated;
