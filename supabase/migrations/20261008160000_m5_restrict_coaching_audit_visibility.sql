-- Keep M4 coaching audit metadata within the same active team-coach boundary
-- as the underlying coaching data. Older M4 rows have no trustworthy team
-- context and therefore remain unavailable through the generic audit table.
alter table public.audit_events
  add column team_id uuid;

create index audit_events_team_created_at_idx
  on public.audit_events (club_id, team_id, created_at desc);

alter table public.audit_events
  add constraint audit_events_coaching_action_team_required
  check (
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
    or team_id is not null
  ) not valid;

create or replace function public.set_coaching_audit_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action not in (
    'game.result_saved',
    'game_player_stats.created', 'game_player_stats.corrected',
    'post_game_review.created', 'post_game_review.completed',
    'post_game_review.updated', 'post_game_review.reopened',
    'recognition.created', 'recognition.updated', 'recognition.removed',
    'private_player_note.created', 'private_player_note.updated',
    'private_player_note.cleared',
    'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied',
    'practice_drill.created'
  ) then
    return new;
  end if;

  if new.team_id is null then
    case new.action
      when 'game.result_saved' then
        select event.team_id into new.team_id
        from public.events as event
        where event.id = new.target_id and event.club_id = new.club_id;
      when 'post_game_review.created', 'post_game_review.completed',
           'post_game_review.updated', 'post_game_review.reopened' then
        select review.team_id into new.team_id
        from public.post_game_reviews as review
        where review.id = new.target_id and review.club_id = new.club_id;
      when 'recognition.created', 'recognition.updated' then
        select recognition.team_id into new.team_id
        from public.player_game_recognitions as recognition
        where recognition.id = new.target_id and recognition.club_id = new.club_id;
      when 'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied' then
        select plan.team_id into new.team_id
        from public.practice_plans as plan
        where plan.id = new.target_id and plan.club_id = new.club_id;
      when 'practice_drill.created' then
        select drill.team_id into new.team_id
        from public.drills as drill
        where drill.id = new.target_id and drill.club_id = new.club_id;
      else
        null;
    end case;
  end if;

  if new.team_id is null then
    raise exception 'COACHING_AUDIT_TEAM_REQUIRED' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.teams as team
    where team.id = new.team_id and team.club_id = new.club_id
  ) then
    raise exception 'COACHING_AUDIT_TEAM_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.set_coaching_audit_team() from public, anon, authenticated;

create trigger set_coaching_audit_team_before_write
  before insert or update of action, target_id, team_id, club_id
  on public.audit_events
  for each row
  execute function public.set_coaching_audit_team();

-- Recover exact team context for legacy rows whose target IDs still resolve
-- unambiguously. Rows targeting only a player or deleted recognition records
-- remain unscoped and hidden through the generic audit table.
update public.audit_events as audit
set team_id = null
where audit.team_id is null
  and audit.action = 'game.result_saved'
  and exists (
    select 1 from public.events as event
    where event.id = audit.target_id and event.club_id = audit.club_id
  );

update public.audit_events as audit
set team_id = null
where audit.team_id is null
  and audit.action in (
    'post_game_review.created', 'post_game_review.completed',
    'post_game_review.updated', 'post_game_review.reopened'
  )
  and exists (
    select 1 from public.post_game_reviews as review
    where review.id = audit.target_id and review.club_id = audit.club_id
  );

update public.audit_events as audit
set team_id = null
where audit.team_id is null
  and audit.action in ('recognition.created', 'recognition.updated')
  and exists (
    select 1 from public.player_game_recognitions as recognition
    where recognition.id = audit.target_id and recognition.club_id = audit.club_id
  );

update public.audit_events as audit
set team_id = null
where audit.team_id is null
  and audit.action in (
    'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied'
  )
  and exists (
    select 1 from public.practice_plans as plan
    where plan.id = audit.target_id and plan.club_id = audit.club_id
  );

update public.audit_events as audit
set team_id = null
where audit.team_id is null
  and audit.action = 'practice_drill.created'
  and exists (
    select 1 from public.drills as drill
    where drill.id = audit.target_id and drill.club_id = audit.club_id
  );

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
      )
    )
  );

-- Stats writes supply their game team directly; the generic audit target is
-- still an opaque player id and the detailed revision remains coach-only.
create or replace function public.save_game_player_stat(
  p_event_id uuid,
  p_player_id uuid,
  p_points integer,
  p_rebounds integer,
  p_assists integer,
  p_steals integer,
  p_fouls integer,
  p_approximate_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  old_row public.game_player_stats;
  scheduled_minutes integer;
  creating boolean;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_points not between 0 and 100
    or p_rebounds not between 0 and 100
    or p_assists not between 0 and 100
    or p_steals not between 0 and 100
    or p_fouls not between 0 and 20
    or p_approximate_minutes is null
    or p_approximate_minutes < 0 then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  select event.* into event_row
  from public.events as event
  where event.id = p_event_id and event.event_type = 'GAME'
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_coaching_stats_team(event_row.team_id);
  if not exists (select 1 from public.games where event_id = event_row.id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  scheduled_minutes := case when event_row.ends_at is null then 120
    else floor(extract(epoch from (event_row.ends_at - event_row.starts_at)) / 60)::integer
  end;
  if p_approximate_minutes > scheduled_minutes then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_player_id::text, 0));
  select stats.* into old_row
  from public.game_player_stats as stats
  where stats.game_event_id = p_event_id and stats.player_id = p_player_id
  for update;
  creating := not found;

  if creating and not exists (
    select 1
    from public.players as player
    join public.player_team_registrations as registration
      on registration.player_id = player.id
      and registration.club_id = player.club_id
      and registration.team_id = event_row.team_id
      and registration.active
    where player.id = p_player_id
      and player.club_id = event_row.club_id
      and player.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if creating then
    insert into public.game_player_stats (
      game_event_id, club_id, team_id, player_id,
      points, rebounds, assists, steals, fouls, approximate_minutes
    ) values (
      event_row.id, event_row.club_id, event_row.team_id, p_player_id,
      p_points, p_rebounds, p_assists, p_steals, p_fouls, p_approximate_minutes
    );
    insert into public.audit_events (club_id, team_id, actor_user_id, action, target_id)
    values (event_row.club_id, event_row.team_id, actor, 'game_player_stats.created', p_player_id);
  elsif old_row.points is distinct from p_points
    or old_row.rebounds is distinct from p_rebounds
    or old_row.assists is distinct from p_assists
    or old_row.steals is distinct from p_steals
    or old_row.fouls is distinct from p_fouls
    or old_row.approximate_minutes is distinct from p_approximate_minutes then
    update public.game_player_stats
    set points = p_points, rebounds = p_rebounds, assists = p_assists,
        steals = p_steals, fouls = p_fouls,
        approximate_minutes = p_approximate_minutes
    where game_event_id = p_event_id and player_id = p_player_id;
    insert into public.game_player_stat_revisions (
      game_event_id, player_id, actor_user_id,
      before_points, before_rebounds, before_assists, before_steals,
      before_fouls, before_approximate_minutes,
      after_points, after_rebounds, after_assists, after_steals,
      after_fouls, after_approximate_minutes
    ) values (
      p_event_id, p_player_id, actor,
      old_row.points, old_row.rebounds, old_row.assists, old_row.steals,
      old_row.fouls, old_row.approximate_minutes,
      p_points, p_rebounds, p_assists, p_steals, p_fouls, p_approximate_minutes
    );
    insert into public.audit_events (club_id, team_id, actor_user_id, action, target_id)
    values (event_row.club_id, event_row.team_id, actor, 'game_player_stats.corrected', p_player_id);
  end if;
end;
$$;

-- Note lifecycle metadata remains actor/time/opaque player id only; its team
-- context comes from the validated game event, never from caller input.
create or replace function public.save_private_player_game_note(p_event_id uuid, p_player_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); event_row public.events; old_row public.private_player_game_notes; normalized_note text;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, true);
  if not exists(select 1 from public.player_team_registrations registration where registration.player_id = p_player_id and registration.team_id = event_row.team_id and registration.club_id = event_row.club_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  normalized_note := nullif(btrim(coalesce(p_note, '')), '');
  if normalized_note is not null and (char_length(normalized_note) > 2000 or translate(normalized_note, E'\n', '') ~ '[[:cntrl:]]') then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  select note.* into old_row from public.private_player_game_notes note where note.game_event_id = event_row.id and note.player_id = p_player_id for update;
  if normalized_note is null then
    delete from public.private_player_game_notes where game_event_id = event_row.id and player_id = p_player_id;
    if old_row.game_event_id is not null then insert into public.audit_events(club_id, team_id, actor_user_id, action, target_id) values(event_row.club_id, event_row.team_id, actor, 'private_player_note.cleared', p_player_id); end if;
  else
    if old_row.game_event_id is null then
      insert into public.private_player_game_notes(game_event_id, club_id, team_id, player_id, note, author_user_id, updated_by) values(event_row.id, event_row.club_id, event_row.team_id, p_player_id, normalized_note, actor, actor);
      insert into public.audit_events(club_id, team_id, actor_user_id, action, target_id) values(event_row.club_id, event_row.team_id, actor, 'private_player_note.created', p_player_id);
    elsif old_row.note is distinct from normalized_note then
      update public.private_player_game_notes set note = normalized_note, updated_by = actor where game_event_id = event_row.id and player_id = p_player_id;
      insert into public.audit_events(club_id, team_id, actor_user_id, action, target_id) values(event_row.club_id, event_row.team_id, actor, 'private_player_note.updated', p_player_id);
    end if;
  end if;
end;
$$;

create or replace function public.remove_player_game_recognition(p_event_id uuid, p_player_id uuid, p_category text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); event_row public.events; removed_id uuid;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, false);
  if p_category not in ('MVP','HUSTLE','DEFENCE','TEAMWORK') or p_category is null then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  delete from public.player_game_recognitions where game_event_id = event_row.id and player_id = p_player_id and category = p_category returning id into removed_id;
  if removed_id is not null then insert into public.audit_events(club_id, team_id, actor_user_id, action, target_id) values(event_row.club_id, event_row.team_id, actor, 'recognition.removed', removed_id); end if;
end;
$$;
