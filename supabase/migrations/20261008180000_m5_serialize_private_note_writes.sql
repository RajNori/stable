-- A row-level lock cannot protect the absent row during concurrent first
-- writes. Serialize by game/player before looking up or creating the note.
create or replace function public.save_private_player_game_note(
  p_event_id uuid,
  p_player_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_row public.events;
  old_row public.private_player_game_notes;
  normalized_note text;
begin
  select event.* into event_row
  from public.events as event
  where event.id = p_event_id
    and event.event_type = 'GAME'
    and exists (select 1 from public.games as game where game.event_id = event.id);
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_post_game_review_actor(event_row.team_id, true);
  if not exists (
    select 1
    from public.player_team_registrations as registration
    where registration.player_id = p_player_id
      and registration.team_id = event_row.team_id
      and registration.club_id = event_row.club_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  normalized_note := nullif(btrim(coalesce(p_note, '')), '');
  if normalized_note is not null and (
    char_length(normalized_note) > 2000
    or translate(normalized_note, E'\n', '') ~ '[[:cntrl:]]'
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(event_row.id::text || ':' || p_player_id::text, 0)
  );
  select note.* into old_row
  from public.private_player_game_notes as note
  where note.game_event_id = event_row.id and note.player_id = p_player_id
  for update;

  if normalized_note is null then
    delete from public.private_player_game_notes
    where game_event_id = event_row.id and player_id = p_player_id;
    if old_row.game_event_id is not null then
      insert into public.audit_events (club_id, team_id, actor_user_id, action, target_id)
      values (event_row.club_id, event_row.team_id, actor, 'private_player_note.cleared', p_player_id);
    end if;
  elsif old_row.game_event_id is null then
    insert into public.private_player_game_notes (
      game_event_id, club_id, team_id, player_id, note, author_user_id, updated_by
    ) values (
      event_row.id, event_row.club_id, event_row.team_id, p_player_id,
      normalized_note, actor, actor
    );
    insert into public.audit_events (club_id, team_id, actor_user_id, action, target_id)
    values (event_row.club_id, event_row.team_id, actor, 'private_player_note.created', p_player_id);
  elsif old_row.note is distinct from normalized_note then
    update public.private_player_game_notes
    set note = normalized_note, updated_by = actor
    where game_event_id = event_row.id and player_id = p_player_id;
    insert into public.audit_events (club_id, team_id, actor_user_id, action, target_id)
    values (event_row.club_id, event_row.team_id, actor, 'private_player_note.updated', p_player_id);
  end if;
end;
$$;
