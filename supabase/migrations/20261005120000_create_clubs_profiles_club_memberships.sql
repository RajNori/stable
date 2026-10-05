-- Milestone 0 architecture-proof tables.
-- Classification: additive. No existing data, no backfill, no destructive change.
-- Authenticated clients may select only through the policies below.
-- Insert, update, and delete are not granted to anon or authenticated.
-- service_role is for the local Auth Admin bootstrap script, not for clients.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null,
  theme_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id),
  display_name text not null,
  first_name text not null,
  last_name text not null,
  phone_e164 text null,
  email text null,
  locale text not null default 'en-AU',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164_check check (
    phone_e164 is null
    or phone_e164 ~ '^\+[1-9][0-9]{1,14}$'
  )
);

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  user_id uuid not null references auth.users (id),
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_memberships_role_check check (role = 'CLUB_ADMIN')
);

create unique index club_memberships_one_active_per_club_user
  on public.club_memberships (club_id, user_id)
  where active;

create index club_memberships_club_id_idx
  on public.club_memberships (club_id);

create index club_memberships_user_id_idx
  on public.club_memberships (user_id);

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row
  execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create trigger club_memberships_set_updated_at
  before update on public.club_memberships
  for each row
  execute function public.set_updated_at();

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.club_memberships enable row level security;

alter table public.clubs force row level security;
alter table public.profiles force row level security;
alter table public.club_memberships force row level security;

revoke all on table public.clubs from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.club_memberships from public, anon, authenticated;

grant select on table public.clubs to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.club_memberships to authenticated;

grant select, insert, update, delete on table public.clubs to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.club_memberships to service_role;

-- Active club membership is the only tenant path in Milestone 0.
-- There is no team table yet, so same-club wrong-team denial is not expressible here.
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
  );

-- Own profile is visible only while the user has an active club membership.
-- An outsider therefore selects no profile rows.
create policy profiles_select_own_active_member
  on public.profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.club_memberships as membership
      where membership.user_id = (select auth.uid())
        and membership.active
    )
  );

create policy club_memberships_select_own_active
  on public.club_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and active
  );
