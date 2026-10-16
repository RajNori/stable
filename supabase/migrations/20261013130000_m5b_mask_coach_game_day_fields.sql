-- Retain the established fixture-read RPC boundary but return coaching-only
-- overlay fields only to an active coach of this exact team. The internal
-- projection is no longer directly executable by API roles.
alter function public.read_game_day(uuid)
  rename to read_game_day_unfiltered;

revoke all on function public.read_game_day_unfiltered(uuid)
  from public, anon, authenticated;

create function public.read_game_day(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  team_id uuid,
  opponent_name text,
  round_label text,
  fixture_source text,
  fixture_status text,
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
  unanswered_count integer,
  fill_in_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value record;
  coach boolean;
begin
  for row_value in
    select * from public.read_game_day_unfiltered(p_event_id)
  loop
    select exists (
      select 1
      from public.team_memberships as membership
      join public.teams as team
        on team.id = membership.team_id
        and team.club_id = membership.club_id
        and team.active
      where membership.team_id = row_value.team_id
        and membership.club_id = row_value.club_id
        and membership.user_id = (select auth.uid())
        and membership.active
        and membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    ) into coach;

    return query
    select
      row_value.event_id,
      row_value.club_id,
      row_value.team_id,
      row_value.opponent_name,
      row_value.round_label,
      row_value.fixture_source,
      row_value.fixture_status,
      row_value.official_start_at,
      row_value.arrival_at,
      row_value.venue_text,
      row_value.court_label,
      row_value.uniform_note,
      case when coach then row_value.coach_focus else null end,
      row_value.own_rsvp,
      row_value.own_duty_label,
      row_value.own_duty_status,
      row_value.attending_count,
      row_value.unavailable_count,
      row_value.unsure_count,
      row_value.unanswered_count,
      row_value.fill_in_label;
  end loop;
end;
$$;

revoke all on function public.read_game_day(uuid)
  from public, anon, authenticated;
grant execute on function public.read_game_day(uuid) to authenticated;
