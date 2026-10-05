-- Slice 1.1 remediation.
-- Update lookups authorize before they reveal whether an id exists.
-- A missing id, another club's id, and a club the caller cannot administer
-- all raise NOT_FOUND. Create functions are unchanged.

create or replace function public.update_club_season(
  p_season_id uuid,
  p_name text,
  p_active boolean
)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.seasons;
begin
  select s.*
  into existing
  from public.seasons as s
  where s.id = p_season_id
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = s.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    );

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.seasons
  set name = public.structure_name(p_name), active = p_active
  where id = p_season_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'season.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.update_club_competition(
  p_competition_id uuid,
  p_name text,
  p_active boolean
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.competitions;
begin
  select competition.*
  into existing
  from public.competitions as competition
  where competition.id = p_competition_id
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = competition.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    );

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.competitions
  set name = public.structure_name(p_name), active = p_active
  where id = p_competition_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'competition.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.update_club_venue(
  p_venue_id uuid,
  p_name text,
  p_active boolean
)
returns public.venues
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.venues;
begin
  select venue.*
  into existing
  from public.venues as venue
  where venue.id = p_venue_id
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = venue.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    );

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.venues
  set name = public.structure_name(p_name), active = p_active
  where id = p_venue_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'venue.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.update_club_team(
  p_team_id uuid,
  p_name text,
  p_active boolean
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.teams;
begin
  select team.*
  into existing
  from public.teams as team
  where team.id = p_team_id
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = team.club_id
        and membership.user_id = actor
        and membership.active
        and membership.role = 'CLUB_ADMIN'
    );

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.teams
  set name = public.structure_name(p_name), active = p_active
  where id = p_team_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'team.updated', existing.id);

  return existing;
end;
$$;

revoke all on function public.update_club_season(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.update_club_competition(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.update_club_venue(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.update_club_team(uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.update_club_season(uuid, text, boolean) to authenticated;
grant execute on function public.update_club_competition(uuid, text, boolean) to authenticated;
grant execute on function public.update_club_venue(uuid, text, boolean) to authenticated;
grant execute on function public.update_club_team(uuid, text, boolean) to authenticated;
