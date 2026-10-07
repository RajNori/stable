-- Frozen M4 least-privilege boundary: coaching data requires a current coach
-- membership on the exact active team. Club Admin scope does not imply coaching.

create or replace function public.assert_coaching_stats_team(p_team_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  select team.* into team_row
  from public.teams as team
  where team.id = p_team_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not team_row.active then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return team_row;
end;
$$;

create or replace function public.assert_post_game_review_actor(
  p_team_id uuid,
  p_private_note boolean default false
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  select team.* into team_row
  from public.teams as team
  where team.id = p_team_id;
  if not found or not team_row.active then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  ) then
    return;
  end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.assert_practice_plan_actor(p_team_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  team_row public.teams;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  select team.* into team_row
  from public.teams as team
  where team.id = p_team_id and team.active;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id
      and membership.user_id = actor
      and membership.active
      and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  ) then
    return;
  end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

revoke all on function public.assert_coaching_stats_team(uuid) from public, anon, authenticated;
revoke all on function public.assert_post_game_review_actor(uuid, boolean) from public, anon, authenticated;
revoke all on function public.assert_practice_plan_actor(uuid) from public, anon, authenticated;
