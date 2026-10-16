-- Suppress duty and coach check-in notices when their team is deactivated.
create or replace function public.notification_request_is_current(
  p_request_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_row public.notification_requests;
begin
  select request.*
  into request_row
  from public.notification_requests as request
  where request.id = p_request_id;

  if not found then
    return false;
  end if;

  if request_row.notification_type in (
    'ANNOUNCEMENT_PUBLISHED',
    'FIXTURE_CHANGED',
    'GAME_REMINDER',
    'RSVP_REQUIRED',
    'TRAINING_CHANGED',
    'TRAINING_CANCELLED'
  ) then
    return public.user_can_read_team_announcements(
      request_row.recipient_user_id,
      request_row.team_id
    );
  end if;

  if request_row.notification_type in (
    'DUTY_SWAP_ACCEPTED',
    'DUTY_ASSIGNED',
    'DUTY_SWAP_REQUESTED'
  ) then
    return exists (
      select 1
      from public.teams as team
      where team.id = request_row.team_id
        and team.club_id = request_row.club_id
        and team.active
    )
    and public.caller_can_take_duty(
      request_row.club_id,
      request_row.team_id,
      request_row.recipient_user_id
    );
  end if;

  if request_row.notification_type = 'FILL_IN_REQUESTED' then
    return exists (
      select 1
      from public.fill_in_requests as source_request
      where source_request.id = request_row.source_id
        and source_request.status = 'OPEN'
        and not exists (
          select 1
          from public.fill_in_confirmations as confirmation
          where confirmation.event_id = source_request.event_id
        )
    )
    and exists (
      select 1
      from public.guardian_relationships as relationship
      where relationship.user_id = request_row.recipient_user_id
        and relationship.club_id = request_row.club_id
        and relationship.active
        and public.player_is_fill_in_candidate(
          request_row.team_id,
          relationship.player_id
        )
    );
  end if;

  if request_row.notification_type = 'FILL_IN_CONFIRMED' then
    return exists (
      select 1
      from public.fill_in_confirmations as confirmation
      join public.guardian_relationships as relationship
        on relationship.player_id = confirmation.player_id
        and relationship.club_id = request_row.club_id
      where confirmation.request_id = request_row.source_id
        and relationship.user_id = request_row.recipient_user_id
        and relationship.active
    );
  end if;

  if request_row.notification_type = 'COACH_CHECKED_IN' then
    return exists (
      select 1
      from public.team_memberships as membership
      join public.teams as team
        on team.id = membership.team_id
        and team.club_id = membership.club_id
        and team.active
      where membership.club_id = request_row.club_id
        and membership.team_id = request_row.team_id
        and membership.user_id = request_row.recipient_user_id
        and membership.active
        and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    );
  end if;

  return false;
end;
$$;
