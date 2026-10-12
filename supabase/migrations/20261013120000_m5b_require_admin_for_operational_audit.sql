-- Make the operational audit boundary explicit: only active Club Admin
-- membership grants generic audit access. M4 coaching audit remains governed
-- by the separate exact-team coach branch.
drop policy audit_events_select_active_member on public.audit_events;

create policy audit_events_select_active_member
  on public.audit_events
  for select
  to authenticated
  using (
    (
      action in (
        'game.result_saved',
        'game_player_stats.created', 'game_player_stats.corrected',
        'post_game_review.created', 'post_game_review.completed',
        'post_game_review.updated', 'post_game_review.reopened',
        'recognition.created', 'recognition.updated', 'recognition.removed',
        'private_player_note.created', 'private_player_note.updated',
        'private_player_note.cleared',
        'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied',
        'practice_drill.created'
      )
      and team_id is not null
      and exists (
        select 1
        from public.teams as audited_team
        where audited_team.id = audit_events.team_id
          and audited_team.club_id = audit_events.club_id
          and audited_team.active
      )
      and exists (
        select 1
        from public.team_memberships as coach_membership
        where coach_membership.team_id = audit_events.team_id
          and coach_membership.club_id = audit_events.club_id
          and coach_membership.user_id = (select auth.uid())
          and coach_membership.active
          and coach_membership.role in ('HEAD_COACH', 'ASSISTANT_COACH')
      )
    )
    or (
      action not in (
        'game.result_saved',
        'game_player_stats.created', 'game_player_stats.corrected',
        'post_game_review.created', 'post_game_review.completed',
        'post_game_review.updated', 'post_game_review.reopened',
        'recognition.created', 'recognition.updated', 'recognition.removed',
        'private_player_note.created', 'private_player_note.updated',
        'private_player_note.cleared',
        'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied',
        'practice_drill.created'
      )
      and exists (
        select 1
        from public.club_memberships as club_membership
        where club_membership.club_id = audit_events.club_id
          and club_membership.user_id = (select auth.uid())
          and club_membership.active
          and club_membership.role = 'CLUB_ADMIN'
      )
    )
  );
