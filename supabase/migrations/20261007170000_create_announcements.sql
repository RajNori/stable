-- Slice 3.1 announcements. One team-scoped message, adult read and acknowledgement.

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
      'player_team.unregistered',
      'invitation.created',
      'invitation.revoked',
      'invitation.accepted',
      'fixture.created',
      'fixture.imported',
      'fixture.official_updated',
      'fixture.overlay_updated',
      'duty.assigned',
      'attendance.recorded',
      'training.created',
      'training.series_created',
      'training.updated',
      'training.checked_in',
      'announcement.published',
      'announcement.updated',
      'announcement.archived',
      'announcement.acknowledged'
    )
  );

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  team_id uuid not null,
  author_user_id uuid not null,
  category text not null,
  importance text not null,
  title text not null,
  body text not null,
  acknowledgement_required boolean not null,
  published_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint announcements_team_club_fkey
    foreign key (team_id, club_id) references public.teams (id, club_id),
  constraint announcements_author_fkey
    foreign key (author_user_id) references public.profiles (user_id),
  constraint announcements_category_check check (
    category in ('GENERAL', 'FIXTURE', 'TRAINING', 'DUTY')
  ),
  constraint announcements_importance_check check (
    importance in ('NORMAL', 'IMPORTANT')
  ),
  constraint announcements_title_check check (char_length(title) between 1 and 120),
  constraint announcements_body_check check (char_length(body) between 1 and 2000)
);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id),
  user_id uuid not null references public.profiles (user_id),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table public.announcement_acknowledgements (
  announcement_id uuid not null references public.announcements (id),
  user_id uuid not null references public.profiles (user_id),
  acknowledged_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index announcements_team_published_idx
  on public.announcements (team_id, published_at desc);

alter table public.announcements enable row level security;
alter table public.announcements force row level security;
alter table public.announcement_reads enable row level security;
alter table public.announcement_reads force row level security;
alter table public.announcement_acknowledgements enable row level security;
alter table public.announcement_acknowledgements force row level security;

revoke all on table public.announcements from public, anon, authenticated;
revoke all on table public.announcement_reads from public, anon, authenticated;
revoke all on table public.announcement_acknowledgements from public, anon, authenticated;
grant select, insert, update, delete on table public.announcements to service_role;
grant select, insert, update, delete on table public.announcement_reads to service_role;
grant select, insert, update, delete on table public.announcement_acknowledgements to service_role;

create or replace function public.assert_announcement_team(
  p_team_id uuid,
  p_mode text
)
returns public.teams
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

  if not found or not team_row.active then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_mode = 'publish' then
    if public.caller_is_club_admin(team_row.club_id)
      or exists (
        select 1
        from public.team_memberships as membership
        where membership.team_id = team_row.id
          and membership.club_id = team_row.club_id
          and membership.user_id = actor
          and membership.active
          and membership.role in ('HEAD_COACH', 'TEAM_MANAGER')
      )
    then
      return team_row;
    end if;
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_mode = 'read' then
    if public.caller_is_club_admin(team_row.club_id)
      or exists (
        select 1
        from public.team_memberships as membership
        where membership.team_id = team_row.id
          and membership.club_id = team_row.club_id
          and membership.user_id = actor
          and membership.active
      )
      or exists (
        select 1
        from public.guardian_relationships as relationship
        join public.player_team_registrations as registration
          on registration.player_id = relationship.player_id
          and registration.club_id = relationship.club_id
        join public.players as player
          on player.id = relationship.player_id
        where relationship.user_id = actor
          and relationship.club_id = team_row.club_id
          and relationship.active
          and registration.team_id = team_row.id
          and registration.active
          and player.active
      )
    then
      return team_row;
    end if;
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  raise exception 'VALIDATION_FAILED' using errcode = '23514';
end;
$$;

create or replace function public.publish_announcement(
  p_club_id uuid,
  p_team_id uuid,
  p_category text,
  p_importance text,
  p_title text,
  p_body text,
  p_acknowledgement_required boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  team_row public.teams;
  created_id uuid;
begin
  team_row := public.assert_announcement_team(p_team_id, 'publish');
  if team_row.club_id is distinct from p_club_id then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  if p_category not in ('GENERAL', 'FIXTURE', 'TRAINING', 'DUTY')
    or p_importance not in ('NORMAL', 'IMPORTANT')
    or p_acknowledgement_required is null
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.announcements (
    club_id,
    team_id,
    author_user_id,
    category,
    importance,
    title,
    body,
    acknowledgement_required
  )
  values (
    team_row.club_id,
    team_row.id,
    actor,
    p_category,
    p_importance,
    public.fixture_text(p_title, 120, true),
    public.fixture_text(p_body, 2000, true),
    p_acknowledgement_required
  )
  returning id into created_id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (team_row.club_id, actor, 'announcement.published', created_id);

  return created_id;
end;
$$;

create or replace function public.edit_announcement(
  p_announcement_id uuid,
  p_category text,
  p_importance text,
  p_title text,
  p_body text,
  p_acknowledgement_required boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_to_edit public.announcements;
begin
  select announcement.*
  into row_to_edit
  from public.announcements as announcement
  where announcement.id = p_announcement_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(row_to_edit.team_id, 'publish');

  if row_to_edit.archived_at is not null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if p_category not in ('GENERAL', 'FIXTURE', 'TRAINING', 'DUTY')
    or p_importance not in ('NORMAL', 'IMPORTANT')
    or p_acknowledgement_required is null
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  update public.announcements
  set category = p_category,
      importance = p_importance,
      title = public.fixture_text(p_title, 120, true),
      body = public.fixture_text(p_body, 2000, true),
      acknowledgement_required = p_acknowledgement_required
  where id = row_to_edit.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (row_to_edit.club_id, actor, 'announcement.updated', row_to_edit.id);

  return row_to_edit.id;
end;
$$;

create or replace function public.archive_announcement(p_announcement_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_to_archive public.announcements;
begin
  select announcement.*
  into row_to_archive
  from public.announcements as announcement
  where announcement.id = p_announcement_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(row_to_archive.team_id, 'publish');

  if row_to_archive.archived_at is null then
    update public.announcements
    set archived_at = now()
    where id = row_to_archive.id;

    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (row_to_archive.club_id, actor, 'announcement.archived', row_to_archive.id);
  end if;

  return row_to_archive.id;
end;
$$;

create or replace function public.list_team_announcements(
  p_team_id uuid,
  p_include_archived boolean
)
returns table (
  id uuid,
  club_id uuid,
  team_id uuid,
  author_user_id uuid,
  category text,
  importance text,
  title text,
  body text,
  acknowledgement_required boolean,
  published_at timestamptz,
  archived_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
  team_row public.teams;
  show_archived boolean := false;
begin
  team_row := public.assert_announcement_team(p_team_id, 'read');
  if p_include_archived then
    begin
      perform public.assert_announcement_team(p_team_id, 'publish');
      show_archived := true;
    exception
      when sqlstate '42501' then
        show_archived := false;
    end;
  end if;

  return query
  select
    announcement.id,
    announcement.club_id,
    announcement.team_id,
    announcement.author_user_id,
    announcement.category,
    announcement.importance,
    announcement.title,
    announcement.body,
    announcement.acknowledgement_required,
    announcement.published_at,
    announcement.archived_at,
    read_row.read_at,
    acknowledgement.acknowledged_at
  from public.announcements as announcement
  left join public.announcement_reads as read_row
    on read_row.announcement_id = announcement.id
    and read_row.user_id = actor
  left join public.announcement_acknowledgements as acknowledgement
    on acknowledgement.announcement_id = announcement.id
    and acknowledgement.user_id = actor
  where announcement.team_id = team_row.id
    and (show_archived or announcement.archived_at is null)
  order by announcement.published_at desc;
end;
$$;

create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_to_read public.announcements;
begin
  select announcement.*
  into row_to_read
  from public.announcements as announcement
  where announcement.id = p_announcement_id;

  if not found or row_to_read.archived_at is not null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(row_to_read.team_id, 'read');

  insert into public.announcement_reads (announcement_id, user_id)
  values (row_to_read.id, actor)
  on conflict (announcement_id, user_id) do nothing;
end;
$$;

create or replace function public.acknowledge_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_to_ack public.announcements;
  inserted_id uuid;
begin
  select announcement.*
  into row_to_ack
  from public.announcements as announcement
  where announcement.id = p_announcement_id
  for update;

  if not found or row_to_ack.archived_at is not null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(row_to_ack.team_id, 'read');

  if not row_to_ack.acknowledgement_required then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.announcement_acknowledgements (announcement_id, user_id)
  values (row_to_ack.id, actor)
  on conflict (announcement_id, user_id) do nothing
  returning announcement_id into inserted_id;

  if inserted_id is not null then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (row_to_ack.club_id, actor, 'announcement.acknowledged', row_to_ack.id);
  end if;
end;
$$;

create or replace function public.list_announcement_acknowledgements(
  p_announcement_id uuid
)
returns table (
  user_id uuid,
  acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  row_to_list public.announcements;
begin
  select announcement.*
  into row_to_list
  from public.announcements as announcement
  where announcement.id = p_announcement_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(row_to_list.team_id, 'publish');

  return query
  select acknowledgement.user_id, acknowledgement.acknowledged_at
  from public.announcement_acknowledgements as acknowledgement
  where acknowledgement.announcement_id = row_to_list.id
  order by acknowledgement.acknowledged_at;
end;
$$;

revoke all on function public.assert_announcement_team(uuid, text)
  from public, anon, authenticated;
revoke all on function public.publish_announcement(uuid, uuid, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.edit_announcement(uuid, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.archive_announcement(uuid)
  from public, anon, authenticated;
revoke all on function public.list_team_announcements(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.mark_announcement_read(uuid)
  from public, anon, authenticated;
revoke all on function public.acknowledge_announcement(uuid)
  from public, anon, authenticated;
revoke all on function public.list_announcement_acknowledgements(uuid)
  from public, anon, authenticated;

grant execute on function public.publish_announcement(uuid, uuid, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.edit_announcement(uuid, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.archive_announcement(uuid) to authenticated;
grant execute on function public.list_team_announcements(uuid, boolean) to authenticated;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
grant execute on function public.acknowledge_announcement(uuid) to authenticated;
grant execute on function public.list_announcement_acknowledgements(uuid) to authenticated;
