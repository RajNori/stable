-- Slice 3.2 notifications. Devices, preferences, and an outbox.
-- Push delivery is derived. It does not own the announcement.

create table public.device_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id),
  platform text not null,
  expo_push_token text not null unique,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  constraint device_endpoints_platform_check check (
    platform in ('IOS', 'ANDROID', 'WEB')
  ),
  constraint device_endpoints_token_check check (
    char_length(expo_push_token) between 1 and 200
  )
);

create table public.notification_preferences (
  user_id uuid not null references public.profiles (user_id),
  category text not null,
  push_enabled boolean not null,
  primary key (user_id, category),
  constraint notification_preferences_category_check check (
    category in (
      'FIXTURE_CHANGED',
      'GAME_REMINDER',
      'RSVP_REQUIRED',
      'TRAINING_CHANGED',
      'TRAINING_CANCELLED',
      'ANNOUNCEMENT_PUBLISHED',
      'DUTY_ASSIGNED',
      'DUTY_SWAP_REQUESTED',
      'DUTY_SWAP_ACCEPTED',
      'FILL_IN_REQUESTED',
      'FILL_IN_CONFIRMED',
      'COACH_CHECKED_IN'
    )
  )
);

create table public.notification_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  notification_type text not null,
  source_id uuid not null,
  recipient_user_id uuid not null references public.profiles (user_id),
  payload jsonb not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  constraint notification_requests_team_club_fkey
    foreign key (team_id, club_id) references public.teams (id, club_id),
  constraint notification_requests_type_check check (
    notification_type in (
      'FIXTURE_CHANGED',
      'GAME_REMINDER',
      'RSVP_REQUIRED',
      'TRAINING_CHANGED',
      'TRAINING_CANCELLED',
      'ANNOUNCEMENT_PUBLISHED',
      'DUTY_ASSIGNED',
      'DUTY_SWAP_REQUESTED',
      'DUTY_SWAP_ACCEPTED',
      'FILL_IN_REQUESTED',
      'FILL_IN_CONFIRMED',
      'COACH_CHECKED_IN'
    )
  ),
  constraint notification_requests_status_check check (
    status in ('PENDING', 'SENT', 'SKIPPED', 'FAILED')
  ),
  constraint notification_requests_delivery_key unique (
    notification_type, source_id, recipient_user_id
  )
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.notification_requests (id),
  user_id uuid not null references public.profiles (user_id),
  event_key text not null unique,
  notification_type text not null,
  status text not null,
  attempt_count integer not null default 1,
  provider_message_id text,
  last_error_code text,
  sent_at timestamptz,
  constraint notification_deliveries_status_check check (
    status in ('SENT', 'SKIPPED', 'FAILED')
  )
);

alter table public.device_endpoints enable row level security;
alter table public.device_endpoints force row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;
alter table public.notification_requests enable row level security;
alter table public.notification_requests force row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

revoke all on table public.device_endpoints from public, anon, authenticated;
revoke all on table public.notification_preferences from public, anon, authenticated;
revoke all on table public.notification_requests from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.device_endpoints to service_role;
grant select, insert, update, delete on table public.notification_preferences to service_role;
grant select, insert, update, delete on table public.notification_requests to service_role;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

create or replace function public.user_can_read_team_announcements(
  p_user_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams as team
    join public.club_memberships as membership
      on membership.club_id = team.club_id
    where team.id = p_team_id
      and team.active
      and membership.user_id = p_user_id
      and membership.active
      and membership.role = 'CLUB_ADMIN'
  )
  or exists (
    select 1
    from public.teams as team
    join public.team_memberships as membership
      on membership.team_id = team.id
      and membership.club_id = team.club_id
    where team.id = p_team_id
      and team.active
      and membership.user_id = p_user_id
      and membership.active
  )
  or exists (
    select 1
    from public.teams as team
    join public.guardian_relationships as relationship
      on relationship.club_id = team.club_id
    join public.player_team_registrations as registration
      on registration.player_id = relationship.player_id
      and registration.club_id = relationship.club_id
      and registration.team_id = team.id
    join public.players as player
      on player.id = relationship.player_id
    where team.id = p_team_id
      and team.active
      and relationship.user_id = p_user_id
      and relationship.active
      and registration.active
      and player.active
  );
$$;

create or replace function public.register_device_endpoint(
  p_token text,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  endpoint_id uuid;
  normalized text;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_platform not in ('IOS', 'ANDROID', 'WEB') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;
  normalized := public.fixture_text(p_token, 200, true);

  insert into public.device_endpoints (user_id, platform, expo_push_token)
  values (actor, p_platform, normalized)
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        active = true,
        last_seen_at = now()
  returning id into endpoint_id;

  return endpoint_id;
end;
$$;

create or replace function public.deactivate_device_endpoint(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  updated_count integer;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  update public.device_endpoints
  set active = false
  where expo_push_token = public.fixture_text(p_token, 200, true)
    and user_id = actor;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_notification_preference(
  p_category text,
  p_push_enabled boolean
)
returns void
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
  if p_push_enabled is null
    or p_category not in (
      'FIXTURE_CHANGED',
      'GAME_REMINDER',
      'RSVP_REQUIRED',
      'TRAINING_CHANGED',
      'TRAINING_CANCELLED',
      'ANNOUNCEMENT_PUBLISHED',
      'DUTY_ASSIGNED',
      'DUTY_SWAP_REQUESTED',
      'DUTY_SWAP_ACCEPTED',
      'FILL_IN_REQUESTED',
      'FILL_IN_CONFIRMED',
      'COACH_CHECKED_IN'
    )
  then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.notification_preferences (user_id, category, push_enabled)
  values (actor, p_category, p_push_enabled)
  on conflict (user_id, category) do update
    set push_enabled = excluded.push_enabled;
end;
$$;

create or replace function public.list_notification_preferences()
returns table (
  category text,
  push_enabled boolean
)
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

  return query
  select preference.category, preference.push_enabled
  from public.notification_preferences as preference
  where preference.user_id = actor
  order by preference.category;
end;
$$;

create or replace function public.enqueue_announcement_published(
  p_announcement_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
  announcement_row public.announcements;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select announcement.*
  into announcement_row
  from public.announcements as announcement
  where announcement.id = p_announcement_id;

  if not found or announcement_row.archived_at is not null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_announcement_team(announcement_row.team_id, 'publish');

  insert into public.notification_requests (
    club_id,
    team_id,
    notification_type,
    source_id,
    recipient_user_id,
    payload
  )
  select
    announcement_row.club_id,
    announcement_row.team_id,
    'ANNOUNCEMENT_PUBLISHED',
    announcement_row.id,
    reader.user_id,
    jsonb_build_object(
      'notificationType', 'ANNOUNCEMENT_PUBLISHED',
      'teamId', announcement_row.team_id,
      'announcementId', announcement_row.id,
      'category', announcement_row.category
    )
  from (
    select membership.user_id
    from public.club_memberships as membership
    where membership.club_id = announcement_row.club_id
      and membership.active
      and membership.role = 'CLUB_ADMIN'
    union
    select membership.user_id
    from public.team_memberships as membership
    where membership.team_id = announcement_row.team_id
      and membership.club_id = announcement_row.club_id
      and membership.active
    union
    select relationship.user_id
    from public.guardian_relationships as relationship
    join public.player_team_registrations as registration
      on registration.player_id = relationship.player_id
      and registration.club_id = relationship.club_id
    join public.players as player
      on player.id = relationship.player_id
    where relationship.club_id = announcement_row.club_id
      and relationship.active
      and registration.team_id = announcement_row.team_id
      and registration.active
      and player.active
  ) as reader
  on conflict (notification_type, source_id, recipient_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.apply_notification_provider_result(
  p_request_id uuid,
  p_token text,
  p_result text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
  preference_enabled boolean;
  preference_found boolean := false;
  remaining_devices integer;
  event_key text;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if request_row.status <> 'PENDING' then
    return request_row.status;
  end if;

  event_key := request_row.notification_type
    || ':' || request_row.source_id::text
    || ':' || request_row.recipient_user_id::text;

  if request_row.notification_type = 'ANNOUNCEMENT_PUBLISHED'
    and not public.user_can_read_team_announcements(
      request_row.recipient_user_id,
      request_row.team_id
    )
  then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'REVOKED'
    );
    return 'SKIPPED';
  end if;

  select preference.push_enabled
  into preference_enabled
  from public.notification_preferences as preference
  where preference.user_id = request_row.recipient_user_id
    and preference.category = request_row.notification_type;
  preference_found := found;

  if preference_found and not preference_enabled then
    update public.notification_requests
    set status = 'SKIPPED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SKIPPED',
      'PREFERENCE'
    );
    return 'SKIPPED';
  end if;

  if p_result = 'INVALID' then
    update public.device_endpoints
    set active = false
    where expo_push_token = p_token
      and user_id = request_row.recipient_user_id;

    select count(*)
    into remaining_devices
    from public.device_endpoints as endpoint
    where endpoint.user_id = request_row.recipient_user_id
      and endpoint.active;

    if remaining_devices > 0 then
      return 'PENDING';
    end if;

    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'INVALID'
    );
    return 'FAILED';
  end if;

  if p_result = 'OK' then
    update public.notification_requests
    set status = 'SENT'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, sent_at
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'SENT',
      now()
    );
    return 'SENT';
  end if;

  if p_result = 'ERROR' then
    update public.notification_requests
    set status = 'FAILED'
    where id = request_row.id;
    insert into public.notification_deliveries (
      request_id, user_id, event_key, notification_type, status, last_error_code
    )
    values (
      request_row.id,
      request_row.recipient_user_id,
      event_key,
      request_row.notification_type,
      'FAILED',
      'ERROR'
    );
    return 'FAILED';
  end if;

  raise exception 'VALIDATION_FAILED' using errcode = '23514';
end;
$$;

revoke all on function public.user_can_read_team_announcements(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.register_device_endpoint(text, text)
  from public, anon, authenticated;
revoke all on function public.deactivate_device_endpoint(text)
  from public, anon, authenticated;
revoke all on function public.set_notification_preference(text, boolean)
  from public, anon, authenticated;
revoke all on function public.list_notification_preferences()
  from public, anon, authenticated;
revoke all on function public.enqueue_announcement_published(uuid)
  from public, anon, authenticated;
revoke all on function public.apply_notification_provider_result(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.register_device_endpoint(text, text) to authenticated;
grant execute on function public.deactivate_device_endpoint(text) to authenticated;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;
grant execute on function public.list_notification_preferences() to authenticated;
grant execute on function public.enqueue_announcement_published(uuid) to authenticated;
grant execute on function public.apply_notification_provider_result(uuid, text, text)
  to service_role;
