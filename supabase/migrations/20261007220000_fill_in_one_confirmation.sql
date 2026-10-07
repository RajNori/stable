-- One confirmed fill-in per event. Response and confirmation re-check the game.

alter table public.fill_in_confirmations
  add column event_id uuid;

update public.fill_in_confirmations as confirmation
set event_id = request.event_id
from public.fill_in_requests as request
where request.id = confirmation.request_id
  and confirmation.event_id is null;

alter table public.fill_in_confirmations
  alter column event_id set not null;

alter table public.fill_in_confirmations
  add constraint fill_in_confirmations_event_fkey
  foreign key (event_id) references public.events (id);

create unique index fill_in_requests_id_event
  on public.fill_in_requests (id, event_id);

alter table public.fill_in_confirmations
  add constraint fill_in_confirmations_request_event_fkey
  foreign key (request_id, event_id)
  references public.fill_in_requests (id, event_id);

create unique index fill_in_confirmations_one_event
  on public.fill_in_confirmations (event_id);

drop index public.fill_in_requests_one_open;

create unique index fill_in_requests_one_confirmed
  on public.fill_in_requests (event_id)
  where status = 'CONFIRMED';

create or replace function public.request_fill_in(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.events;
  created_id uuid;
begin
  select event.*
  into event_row
  from public.events as event
  where event.id = p_event_id
  for update;

  if not found
    or event_row.event_type <> 'GAME'
    or event_row.status <> 'SCHEDULED'
    or not exists (
      select 1
      from public.games as game
      where game.event_id = event_row.id
    )
  then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.assert_fill_in_manage(event_row.team_id);

  if exists (
    select 1
    from public.fill_in_confirmations as confirmation
    where confirmation.event_id = event_row.id
  ) or exists (
    select 1
    from public.fill_in_requests as request
    where request.event_id = event_row.id
      and request.status = 'CONFIRMED'
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.fill_in_requests (club_id, team_id, event_id, requested_by)
  values (event_row.club_id, event_row.team_id, event_row.id, actor)
  returning id into created_id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (event_row.club_id, actor, 'fill_in.requested', created_id);

  return created_id;
end;
$$;

create or replace function public.respond_fill_in(
  p_request_id uuid,
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  event_row public.events;
  created_id uuid;
  locked_event_id uuid;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select request.event_id
  into locked_event_id
  from public.fill_in_requests as request
  where request.id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = locked_event_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
  for update;

  if not found or request_row.status <> 'OPEN' then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if event_row.event_type <> 'GAME'
    or event_row.status <> 'SCHEDULED'
    or not exists (
      select 1
      from public.teams as team
      where team.id = event_row.team_id
        and team.club_id = event_row.club_id
        and team.active
    )
    or not exists (
      select 1
      from public.games as game
      where game.event_id = event_row.id
    )
    or exists (
      select 1
      from public.fill_in_confirmations as confirmation
      where confirmation.event_id = event_row.id
    )
  then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.guardian_relationships as relationship
    join public.players as player
      on player.id = relationship.player_id
    where relationship.player_id = p_player_id
      and relationship.user_id = actor
      and relationship.club_id = request_row.club_id
      and relationship.active
      and player.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.player_is_fill_in_candidate(request_row.team_id, p_player_id) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  insert into public.fill_in_responses (request_id, player_id, guardian_user_id)
  values (request_row.id, p_player_id, actor)
  on conflict (request_id, guardian_user_id, player_id) do nothing
  returning id into created_id;

  if created_id is not null then
    insert into public.audit_events (club_id, actor_user_id, action, target_id)
    values (request_row.club_id, actor, 'fill_in.responded', created_id);
    return created_id;
  end if;

  select response.id
  into created_id
  from public.fill_in_responses as response
  where response.request_id = request_row.id
    and response.guardian_user_id = actor
    and response.player_id = p_player_id;

  return created_id;
end;
$$;

create or replace function public.confirm_fill_in(
  p_request_id uuid,
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.fill_in_requests;
  event_row public.events;
  confirmation_id uuid;
  locked_event_id uuid;
begin
  select request.event_id
  into locked_event_id
  from public.fill_in_requests as request
  where request.id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select event.*
  into event_row
  from public.events as event
  where event.id = locked_event_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select request.*
  into request_row
  from public.fill_in_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.status <> 'OPEN' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  if event_row.event_type <> 'GAME'
    or event_row.status <> 'SCHEDULED'
    or not exists (
      select 1
      from public.teams as team
      where team.id = event_row.team_id
        and team.club_id = event_row.club_id
        and team.active
    )
    or not exists (
      select 1
      from public.games as game
      where game.event_id = event_row.id
    )
    or exists (
      select 1
      from public.fill_in_confirmations as confirmation
      where confirmation.event_id = event_row.id
    )
  then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  perform public.assert_fill_in_manage(request_row.team_id);

  if not public.player_is_fill_in_candidate(request_row.team_id, p_player_id) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.fill_in_responses as response
    join public.guardian_relationships as relationship
      on relationship.user_id = response.guardian_user_id
      and relationship.player_id = response.player_id
      and relationship.club_id = request_row.club_id
      and relationship.active
    join public.players as player
      on player.id = response.player_id
      and player.active
    where response.request_id = request_row.id
      and response.player_id = p_player_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  begin
    insert into public.fill_in_confirmations (
      request_id, event_id, player_id, confirmed_by
    )
    values (request_row.id, request_row.event_id, p_player_id, actor)
    returning id into confirmation_id;

    update public.fill_in_requests
    set status = 'CONFIRMED'
    where id = request_row.id
      and status = 'OPEN';

    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  exception
    when unique_violation then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (request_row.club_id, actor, 'fill_in.confirmed', confirmation_id);

  return confirmation_id;
end;
$$;
