-- Slice 3.3 duties. Acknowledge the current assignment, then allocate open duties fairly.

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
      'announcement.acknowledged',
      'duty.acknowledged',
      'duty.allocated'
    )
  );

create or replace function public.create_open_game_duty(
  p_event_id uuid,
  p_duty_type text,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
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

  insert into public.duties (club_id, team_id, event_id, duty_type, label)
  values (
    event_row.club_id,
    event_row.team_id,
    event_row.id,
    p_duty_type,
    public.fixture_text(p_label, 80, true)
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.duty_allocation_candidates(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  candidates jsonb;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', reader.user_id,
      'priorCount', reader.prior_count
    )
    order by reader.prior_count, reader.user_id
  ), '[]'::jsonb)
  into candidates
  from (
    select
      person.user_id,
      coalesce(history.prior_count, 0) as prior_count
    from (
      select membership.user_id
      from public.club_memberships as membership
      where membership.club_id = event_row.club_id
        and membership.active
        and membership.role = 'CLUB_ADMIN'
      union
      select membership.user_id
      from public.team_memberships as membership
      where membership.team_id = event_row.team_id
        and membership.club_id = event_row.club_id
        and membership.active
      union
      select relationship.user_id
      from public.guardian_relationships as relationship
      join public.player_team_registrations as registration
        on registration.player_id = relationship.player_id
        and registration.club_id = relationship.club_id
      join public.players as player
        on player.id = relationship.player_id
      where relationship.club_id = event_row.club_id
        and relationship.active
        and registration.team_id = event_row.team_id
        and registration.active
        and player.active
    ) as person
    left join (
      select assignment.assigned_user_id as user_id, count(*)::integer as prior_count
      from public.duty_assignments as assignment
      join public.duties as duty
        on duty.id = assignment.duty_id
      where duty.team_id = event_row.team_id
      group by assignment.assigned_user_id
    ) as history
      on history.user_id = person.user_id
  ) as reader;

  return candidates;
end;
$$;

create or replace function public.duty_allocation_fingerprint(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  candidates jsonb;
  duty_row record;
  chosen_user text;
  chosen_count integer;
  fingerprint text := '';
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
  candidates := public.duty_allocation_candidates(p_event_id);

  for duty_row in
    select duty.id
    from public.duties as duty
    where duty.event_id = event_row.id
      and not exists (
        select 1
        from public.duty_assignments as assignment
        where assignment.duty_id = duty.id
      )
    order by duty.id
  loop
    select element->>'userId', (element->>'priorCount')::integer
    into chosen_user, chosen_count
    from jsonb_array_elements(candidates) as element
    order by (element->>'priorCount')::integer, element->>'userId'
    limit 1;

    if chosen_user is null then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;

    if fingerprint = '' then
      fingerprint := duty_row.id::text || ':' || chosen_user || ':' || chosen_count::text;
    else
      fingerprint := fingerprint || '|' || duty_row.id::text || ':' || chosen_user || ':' || chosen_count::text;
    end if;

    select coalesce(jsonb_agg(
      case
        when element->>'userId' = chosen_user then
          jsonb_set(element, '{priorCount}', to_jsonb(chosen_count + 1))
        else element
      end
    ), '[]'::jsonb)
    into candidates
    from jsonb_array_elements(candidates) as element;
  end loop;

  return fingerprint;
end;
$$;

create or replace function public.commit_duty_allocation(
  p_event_id uuid,
  p_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  current_fingerprint text;
  piece text;
  duty_id uuid;
  assigned_user uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

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
  current_fingerprint := public.duty_allocation_fingerprint(p_event_id);
  if current_fingerprint is distinct from p_fingerprint then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  foreach piece in array string_to_array(p_fingerprint, '|')
  loop
    duty_id := split_part(piece, ':', 1)::uuid;
    assigned_user := split_part(piece, ':', 2)::uuid;
    if not public.caller_can_take_duty(
      event_row.club_id,
      event_row.team_id,
      assigned_user
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;

    insert into public.duty_assignments (
      duty_id, assigned_user_id, status, assigned_by
    )
    values (duty_id, assigned_user, 'ASSIGNED', actor);
  end loop;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'duty.allocated', event_row.id);
end;
$$;

create or replace function public.acknowledge_own_game_duty(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  updated_count integer := 0;
  assignment_row record;
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

  if not exists (
    select 1
    from public.duty_assignments as assignment
    join public.duties as duty
      on duty.id = assignment.duty_id
    where duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  for assignment_row in
    update public.duty_assignments as assignment
    set acknowledged_at = now()
    from public.duties as duty
    where duty.id = assignment.duty_id
      and duty.event_id = event_row.id
      and assignment.assigned_user_id = actor
      and assignment.acknowledged_at is null
    returning assignment.duty_id
  loop
    updated_count := updated_count + 1;
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (event_row.club_id, actor, 'duty.acknowledged', assignment_row.duty_id);
  end loop;

  return updated_count;
end;
$$;

create or replace function public.list_duty_allocation_inputs(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  duties jsonb;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fixture_team(event_row.team_id, 'manual');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'dutyId', duty.id,
      'dutyType', duty.duty_type,
      'label', duty.label
    )
    order by duty.id
  ), '[]'::jsonb)
  into duties
  from public.duties as duty
  where duty.event_id = event_row.id
    and not exists (
      select 1
      from public.duty_assignments as assignment
      where assignment.duty_id = duty.id
    );

  return jsonb_build_object(
    'duties', duties,
    'candidates', public.duty_allocation_candidates(p_event_id)
  );
end;
$$;

revoke all on function public.create_open_game_duty(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.list_duty_allocation_inputs(uuid)
  from public, anon, authenticated;
revoke all on function public.duty_allocation_candidates(uuid)
  from public, anon, authenticated;
revoke all on function public.duty_allocation_fingerprint(uuid)
  from public, anon, authenticated;
revoke all on function public.commit_duty_allocation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.acknowledge_own_game_duty(uuid)
  from public, anon, authenticated;

grant execute on function public.create_open_game_duty(uuid, text, text) to authenticated;
grant execute on function public.list_duty_allocation_inputs(uuid) to authenticated;
grant execute on function public.duty_allocation_candidates(uuid) to authenticated;
grant execute on function public.duty_allocation_fingerprint(uuid) to authenticated;
grant execute on function public.commit_duty_allocation(uuid, text) to authenticated;
grant execute on function public.acknowledge_own_game_duty(uuid) to authenticated;
