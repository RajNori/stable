-- Slice 2.3 game day projection and one duty assignment.
-- No swap, rotation, or acknowledgement. RSVP stays unanswered until attendance writes exist.

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
      'duty.assigned'
    )
  );

create table public.duties (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid not null,
  event_id uuid not null references public.events (id),
  duty_type text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint duties_team_same_club foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint duties_type_check check (
    duty_type in ('SCORER', 'CLOCK', 'CANTEEN', 'OTHER')
  ),
  constraint duties_label_check check (
    char_length(label) between 1 and 80
    and label = btrim(label)
    and label !~ '[[:cntrl:]]'
  )
);

create table public.duty_assignments (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.duties (id),
  assigned_user_id uuid not null references auth.users (id),
  status text not null default 'ASSIGNED',
  assigned_by uuid not null references auth.users (id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint duty_assignments_status_check check (status = 'ASSIGNED'),
  constraint duty_assignments_one_assignee unique (duty_id)
);

create index duties_event_id_idx on public.duties (event_id);
create index duty_assignments_user_idx on public.duty_assignments (assigned_user_id);

alter table public.duties enable row level security;
alter table public.duty_assignments enable row level security;
alter table public.duties force row level security;
alter table public.duty_assignments force row level security;
revoke all on table public.duties from public, anon, authenticated;
revoke all on table public.duty_assignments from public, anon, authenticated;
grant select, insert, update, delete on table public.duties to service_role;
grant select, insert, update, delete on table public.duty_assignments to service_role;

create or replace function public.caller_can_take_duty(
  p_club_id uuid,
  p_team_id uuid,
  p_user_id uuid
)
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
      and membership.user_id = p_user_id
      and membership.active
      and membership.role = 'CLUB_ADMIN'
  )
  or exists (
    select 1
    from public.team_memberships as membership
    where membership.team_id = p_team_id
      and membership.club_id = p_club_id
      and membership.user_id = p_user_id
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
    where relationship.user_id = p_user_id
      and relationship.club_id = p_club_id
      and relationship.active
      and registration.team_id = p_team_id
      and registration.active
      and player.active
  );
$$;

create or replace function public.read_game_day(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  opponent_name text,
  round_label text,
  official_start_at timestamptz,
  arrival_at timestamptz,
  venue_text text,
  court_label text,
  uniform_note text,
  coach_focus text,
  own_rsvp text,
  own_duty_label text,
  own_duty_status text,
  attending_count integer,
  unavailable_count integer,
  unsure_count integer,
  unanswered_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  staff boolean;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'read');
  staff := public.caller_is_club_admin(event_row.club_id)
    or exists (
      select 1
      from public.team_memberships as membership
      where membership.team_id = event_row.team_id
        and membership.club_id = event_row.club_id
        and membership.user_id = actor
        and membership.active
    );

  return query
  select
    event_row.id,
    event_row.club_id,
    event_row.team_id,
    game.opponent_name,
    game.round_label,
    game.official_start_at,
    overlay.arrival_at,
    game.official_venue_text,
    game.official_court_label,
    overlay.uniform_note,
    overlay.coach_focus,
    'UNANSWERED'::text,
    own_duty.label,
    own_duty.status,
    case when staff then 0 else null end,
    case when staff then 0 else null end,
    case when staff then 0 else null end,
    case
      when staff then (
        select count(*)::integer
        from public.player_team_registrations as registration
        join public.players as player on player.id = registration.player_id
        where registration.team_id = event_row.team_id
          and registration.active
          and player.active
      )
      else null
    end
  from public.games as game
  join public.game_team_overlay as overlay
    on overlay.game_event_id = game.event_id
  left join lateral (
    select duty.label, assignment.status
    from public.duties as duty
    join public.duty_assignments as assignment
      on assignment.duty_id = duty.id
    where duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
    order by duty.created_at
    limit 1
  ) as own_duty on true
  where game.event_id = event_row.id;
end;
$$;

create or replace function public.assign_game_duty(
  p_event_id uuid,
  p_duty_type text,
  p_label text,
  p_assigned_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  normalized text;
  created_id uuid;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');

  if p_duty_type not in ('SCORER', 'CLOCK', 'CANTEEN', 'OTHER') then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  normalized := public.fixture_text(p_label, 80, true);

  if not public.caller_can_take_duty(
    event_row.club_id,
    event_row.team_id,
    p_assigned_user_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.duties (club_id, team_id, event_id, duty_type, label)
  values (event_row.club_id, event_row.team_id, event_row.id, p_duty_type, normalized)
  returning id into created_id;

  insert into public.duty_assignments (duty_id, assigned_user_id, status, assigned_by)
  values (created_id, p_assigned_user_id, 'ASSIGNED', actor);

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'duty.assigned', created_id);

  return created_id;
end;
$$;

revoke all on function public.caller_can_take_duty(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.read_game_day(uuid) from public, anon, authenticated;
revoke all on function public.assign_game_duty(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.read_game_day(uuid) to authenticated;
grant execute on function public.assign_game_duty(uuid, text, text, uuid) to authenticated;
