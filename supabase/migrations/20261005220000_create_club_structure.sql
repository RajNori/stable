-- Slice 1.1 club structure.
-- Classification: additive. No backfill and no destructive change.
-- Authenticated clients may select rows for a club where they have an
-- active membership. Writes go through the security-definer functions below.
-- Same-club wrong-team denial is not expressible until team membership exists.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_name_check check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint seasons_id_club_key unique (id, club_id)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  season_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_name_check check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint competitions_id_club_key unique (id, club_id),
  constraint competitions_season_same_club foreign key (season_id, club_id)
    references public.seasons (id, club_id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_check check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint venues_id_club_key unique (id, club_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  season_id uuid not null,
  competition_id uuid null,
  venue_id uuid null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_check check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint teams_season_same_club foreign key (season_id, club_id)
    references public.seasons (id, club_id),
  constraint teams_competition_same_club foreign key (competition_id, club_id)
    references public.competitions (id, club_id),
  constraint teams_venue_same_club foreign key (venue_id, club_id)
    references public.venues (id, club_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  actor_user_id uuid not null references auth.users (id),
  action text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint audit_events_action_check check (
    action in (
      'season.created',
      'season.updated',
      'competition.created',
      'competition.updated',
      'team.created',
      'team.updated',
      'venue.created',
      'venue.updated'
    )
  )
);

create index seasons_club_id_idx on public.seasons (club_id);
create index competitions_club_id_idx on public.competitions (club_id);
create index venues_club_id_idx on public.venues (club_id);
create index teams_club_id_idx on public.teams (club_id);
create index audit_events_club_id_idx on public.audit_events (club_id);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row
  execute function public.set_updated_at();

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row
  execute function public.set_updated_at();

create trigger venues_set_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();

create trigger teams_set_updated_at
  before update on public.teams
  for each row
  execute function public.set_updated_at();

alter table public.seasons enable row level security;
alter table public.competitions enable row level security;
alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.audit_events enable row level security;

alter table public.seasons force row level security;
alter table public.competitions force row level security;
alter table public.venues force row level security;
alter table public.teams force row level security;
alter table public.audit_events force row level security;

revoke all on table public.seasons from public, anon, authenticated;
revoke all on table public.competitions from public, anon, authenticated;
revoke all on table public.venues from public, anon, authenticated;
revoke all on table public.teams from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select on table public.seasons to authenticated;
grant select on table public.competitions to authenticated;
grant select on table public.venues to authenticated;
grant select on table public.teams to authenticated;
grant select on table public.audit_events to authenticated;

grant select, insert, update, delete on table public.seasons to service_role;
grant select, insert, update, delete on table public.competitions to service_role;
grant select, insert, update, delete on table public.venues to service_role;
grant select, insert, update, delete on table public.teams to service_role;
grant select, insert, update, delete on table public.audit_events to service_role;

create policy seasons_select_active_member
  on public.seasons
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = seasons.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create policy competitions_select_active_member
  on public.competitions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = competitions.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create policy venues_select_active_member
  on public.venues
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = venues.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create policy teams_select_active_member
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
    )
  );

create policy audit_events_select_active_member
  on public.audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = audit_events.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create or replace function public.assert_club_structure_admin(p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.club_memberships
    where club_id = p_club_id
      and user_id = actor
      and active
      and role = 'CLUB_ADMIN'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return actor;
end;
$$;

revoke all on function public.assert_club_structure_admin(uuid)
  from public, anon, authenticated;

create or replace function public.structure_name(p_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  trimmed text := btrim(p_name);
begin
  if trimmed is null or char_length(trimmed) < 1 or char_length(trimmed) > 120 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  return trimmed;
end;
$$;

revoke all on function public.structure_name(text)
  from public, anon, authenticated;

create or replace function public.create_club_season(p_club_id uuid, p_name text)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  created public.seasons;
begin
  insert into public.seasons (club_id, name)
  values (p_club_id, public.structure_name(p_name))
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'season.created', created.id);

  return created;
end;
$$;

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
  existing public.seasons;
  actor uuid;
begin
  select * into existing from public.seasons where id = p_season_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  actor := public.assert_club_structure_admin(existing.club_id);

  update public.seasons
  set name = public.structure_name(p_name), active = p_active
  where id = p_season_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'season.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.create_club_competition(
  p_club_id uuid,
  p_season_id uuid,
  p_name text
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  season_club uuid;
  created public.competitions;
begin
  select club_id into season_club from public.seasons where id = p_season_id;
  if not found or season_club is distinct from p_club_id then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.competitions (club_id, season_id, name)
  values (p_club_id, p_season_id, public.structure_name(p_name))
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'competition.created', created.id);

  return created;
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
  existing public.competitions;
  actor uuid;
begin
  select * into existing from public.competitions where id = p_competition_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  actor := public.assert_club_structure_admin(existing.club_id);

  update public.competitions
  set name = public.structure_name(p_name), active = p_active
  where id = p_competition_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'competition.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.create_club_venue(p_club_id uuid, p_name text)
returns public.venues
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  created public.venues;
begin
  insert into public.venues (club_id, name)
  values (p_club_id, public.structure_name(p_name))
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'venue.created', created.id);

  return created;
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
  existing public.venues;
  actor uuid;
begin
  select * into existing from public.venues where id = p_venue_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  actor := public.assert_club_structure_admin(existing.club_id);

  update public.venues
  set name = public.structure_name(p_name), active = p_active
  where id = p_venue_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'venue.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.create_club_team(
  p_club_id uuid,
  p_season_id uuid,
  p_competition_id uuid,
  p_venue_id uuid,
  p_name text
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  season_club uuid;
  competition_club uuid;
  competition_season uuid;
  venue_club uuid;
  created public.teams;
begin
  select club_id into season_club from public.seasons where id = p_season_id;
  if not found or season_club is distinct from p_club_id then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_competition_id is not null then
    select club_id, season_id
      into competition_club, competition_season
    from public.competitions
    where id = p_competition_id;
    if not found
      or competition_club is distinct from p_club_id
      or competition_season is distinct from p_season_id
    then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
  end if;

  if p_venue_id is not null then
    select club_id into venue_club from public.venues where id = p_venue_id;
    if not found or venue_club is distinct from p_club_id then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
  end if;

  insert into public.teams (
    club_id,
    season_id,
    competition_id,
    venue_id,
    name
  )
  values (
    p_club_id,
    p_season_id,
    p_competition_id,
    p_venue_id,
    public.structure_name(p_name)
  )
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (p_club_id, actor, 'team.created', created.id);

  return created;
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
  existing public.teams;
  actor uuid;
begin
  select * into existing from public.teams where id = p_team_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  actor := public.assert_club_structure_admin(existing.club_id);

  update public.teams
  set name = public.structure_name(p_name), active = p_active
  where id = p_team_id
  returning * into existing;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (existing.club_id, actor, 'team.updated', existing.id);

  return existing;
end;
$$;

create or replace function public.create_club_season_and_team(
  p_club_id uuid,
  p_season_name text,
  p_team_name text
)
returns table (season_id uuid, team_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.assert_club_structure_admin(p_club_id);
  created_season public.seasons;
  created_team public.teams;
begin
  insert into public.seasons (club_id, name)
  values (p_club_id, public.structure_name(p_season_name))
  returning * into created_season;

  insert into public.teams (club_id, season_id, name)
  values (p_club_id, created_season.id, public.structure_name(p_team_name))
  returning * into created_team;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values
    (p_club_id, actor, 'season.created', created_season.id),
    (p_club_id, actor, 'team.created', created_team.id);

  return query
  select created_season.id, created_team.id;
end;
$$;

revoke all on function public.create_club_season(uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_club_season(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.create_club_competition(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_club_competition(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.create_club_venue(uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_club_venue(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.create_club_team(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_club_team(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.create_club_season_and_team(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.create_club_season(uuid, text) to authenticated;
grant execute on function public.update_club_season(uuid, text, boolean) to authenticated;
grant execute on function public.create_club_competition(uuid, uuid, text) to authenticated;
grant execute on function public.update_club_competition(uuid, text, boolean) to authenticated;
grant execute on function public.create_club_venue(uuid, text) to authenticated;
grant execute on function public.update_club_venue(uuid, text, boolean) to authenticated;
grant execute on function public.create_club_team(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.update_club_team(uuid, text, boolean) to authenticated;
grant execute on function public.create_club_season_and_team(uuid, text, text) to authenticated;
