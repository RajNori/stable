-- M4 Slice 4.2. Review text, typed focus, private player notes and recognition.
-- All access is through scoped RPCs; no direct authenticated table access.

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
  action in (
    'season.created', 'season.updated', 'competition.created', 'competition.updated',
    'team.created', 'team.updated', 'venue.created', 'venue.updated',
    'player.created', 'player.imported', 'player.updated', 'player.deactivated', 'player.reactivated',
    'guardian.linked', 'guardian.unlinked', 'team_staff.assigned', 'team_staff.revoked', 'team_staff.reactivated',
    'player_team.registered', 'player_team.unregistered', 'invitation.created', 'invitation.revoked', 'invitation.accepted',
    'fixture.created', 'fixture.imported', 'fixture.official_updated', 'fixture.overlay_updated',
    'duty.assigned', 'attendance.recorded', 'training.created', 'training.series_created', 'training.updated', 'training.checked_in',
    'announcement.published', 'announcement.updated', 'announcement.archived', 'announcement.acknowledged',
    'duty.acknowledged', 'duty.allocated', 'duty.swap_requested', 'duty.swap_accepted', 'duty.swap_cancelled',
    'fill_in.requested', 'fill_in.responded', 'fill_in.confirmed',
    'game.result_saved', 'game_player_stats.created', 'game_player_stats.corrected',
    'post_game_review.created', 'post_game_review.updated', 'post_game_review.completed', 'post_game_review.reopened',
    'recognition.created', 'recognition.updated', 'recognition.removed',
    'private_player_note.created', 'private_player_note.updated', 'private_player_note.cleared'
  )
);

create table public.post_game_reviews (
  id uuid primary key default gen_random_uuid(),
  game_event_id uuid not null unique,
  club_id uuid not null,
  team_id uuid not null,
  what_worked text not null default '',
  needs_improvement text not null default '',
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_game_reviews_event_team_club_fkey foreign key (game_event_id, team_id, club_id)
    references public.events(id, team_id, club_id),
  constraint post_game_reviews_completion_pair check ((completed_by is null) = (completed_at is null)),
  constraint post_game_reviews_what_worked_check check (char_length(what_worked) <= 2000 and what_worked = btrim(what_worked) and translate(what_worked, E'\n', '') !~ '[[:cntrl:]]'),
  constraint post_game_reviews_needs_improvement_check check (char_length(needs_improvement) <= 2000 and needs_improvement = btrim(needs_improvement) and translate(needs_improvement, E'\n', '') !~ '[[:cntrl:]]')
);

create table public.post_game_review_focus (
  review_id uuid not null references public.post_game_reviews(id) on delete cascade,
  focus_code text not null,
  created_at timestamptz not null default now(),
  primary key (review_id, focus_code),
  constraint post_game_review_focus_code_check check (focus_code in ('SHOOTING','BALL_HANDLING','PASSING','REBOUNDING','DEFENCE','COMMUNICATION','TEAMWORK','TRANSITION'))
);

create table public.player_game_recognitions (
  id uuid primary key default gen_random_uuid(),
  game_event_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  player_id uuid not null,
  category text not null,
  note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_game_recognitions_game_team_club_fkey foreign key (game_event_id, team_id, club_id)
    references public.events(id, team_id, club_id),
  constraint player_game_recognitions_player_club_fkey foreign key (player_id, club_id)
    references public.players(id, club_id),
  constraint player_game_recognitions_player_category_key unique (game_event_id, player_id, category),
  constraint player_game_recognitions_category_check check (category in ('MVP','HUSTLE','DEFENCE','TEAMWORK')),
  constraint player_game_recognitions_note_check check (note is null or (char_length(note) between 1 and 500 and note = btrim(note) and translate(note, E'\n', '') !~ '[[:cntrl:]]'))
);
create unique index player_game_recognitions_one_mvp_idx on public.player_game_recognitions(game_event_id) where category = 'MVP';

create table public.private_player_game_notes (
  game_event_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  player_id uuid not null,
  note text not null,
  visibility text not null default 'STAFF_PRIVATE',
  author_user_id uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_event_id, player_id),
  constraint private_player_game_notes_game_team_club_fkey foreign key (game_event_id, team_id, club_id)
    references public.events(id, team_id, club_id),
  constraint private_player_game_notes_player_club_fkey foreign key (player_id, club_id)
    references public.players(id, club_id),
  constraint private_player_game_notes_visibility_check check (visibility = 'STAFF_PRIVATE'),
  constraint private_player_game_notes_note_check check (char_length(note) between 1 and 2000 and note = btrim(note) and translate(note, E'\n', '') !~ '[[:cntrl:]]')
);

create index post_game_reviews_team_idx on public.post_game_reviews(team_id, game_event_id);
create index player_game_recognitions_team_event_idx on public.player_game_recognitions(team_id, game_event_id);
create index private_player_game_notes_team_event_idx on public.private_player_game_notes(team_id, game_event_id);
create trigger post_game_reviews_set_updated_at before update on public.post_game_reviews for each row execute function public.set_updated_at();
create trigger player_game_recognitions_set_updated_at before update on public.player_game_recognitions for each row execute function public.set_updated_at();
create trigger private_player_game_notes_set_updated_at before update on public.private_player_game_notes for each row execute function public.set_updated_at();

alter table public.post_game_reviews enable row level security;
alter table public.post_game_reviews force row level security;
alter table public.post_game_review_focus enable row level security;
alter table public.post_game_review_focus force row level security;
alter table public.player_game_recognitions enable row level security;
alter table public.player_game_recognitions force row level security;
alter table public.private_player_game_notes enable row level security;
alter table public.private_player_game_notes force row level security;
revoke all on table public.post_game_reviews, public.post_game_review_focus, public.player_game_recognitions, public.private_player_game_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.post_game_reviews, public.post_game_review_focus, public.player_game_recognitions, public.private_player_game_notes to service_role;

create or replace function public.assert_post_game_review_actor(p_team_id uuid, p_private_note boolean default false)
returns void language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); team_row public.teams;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select team.* into team_row from public.teams team where team.id = p_team_id;
  if not found or not team_row.active then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.team_memberships membership where membership.team_id = team_row.id and membership.club_id = team_row.club_id and membership.user_id = actor and membership.active and membership.role in ('HEAD_COACH','ASSISTANT_COACH')) then return; end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.read_post_game_review(p_event_id uuid)
returns table(event_id uuid, club_id uuid, team_id uuid, what_worked text, needs_improvement text, focus_codes text[], completed_by uuid, completed_at timestamptz, recognitions jsonb)
language plpgsql security definer set search_path = '' as $$
declare event_row public.events;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, false);
  return query select event_row.id, event_row.club_id, event_row.team_id,
    coalesce(review.what_worked, ''), coalesce(review.needs_improvement, ''),
    coalesce((select array_agg(focus.focus_code order by focus.focus_code) from public.post_game_review_focus focus where focus.review_id = review.id), '{}'::text[]),
    review.completed_by, review.completed_at,
    coalesce((select jsonb_agg(jsonb_build_object('player_id', rec.player_id, 'category', rec.category, 'note', rec.note) order by rec.category, rec.player_id) from public.player_game_recognitions rec where rec.game_event_id = event_row.id), '[]'::jsonb)
  from (select 1) seed left join public.post_game_reviews review on review.game_event_id = event_row.id;
end;
$$;

create or replace function public.save_post_game_review(p_event_id uuid, p_what_worked text, p_needs_improvement text, p_focus_codes jsonb, p_complete boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); event_row public.events; review_row public.post_game_reviews; old_row public.post_game_reviews; normalized_worked text; normalized_improvement text; normalized_focus text[]; old_focus text[]; changed boolean;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id) for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, false);
  normalized_worked := btrim(coalesce(p_what_worked, '')); normalized_improvement := btrim(coalesce(p_needs_improvement, ''));
  if p_what_worked is null or p_needs_improvement is null or char_length(normalized_worked) > 2000 or char_length(normalized_improvement) > 2000 or translate(normalized_worked, E'\n', '') ~ '[[:cntrl:]]' or translate(normalized_improvement, E'\n', '') ~ '[[:cntrl:]]' or p_complete is null or p_focus_codes is null or jsonb_typeof(p_focus_codes) <> 'array' or jsonb_array_length(p_focus_codes) > 5 then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  select array_agg(value order by value) into normalized_focus from (select jsonb_array_elements_text(p_focus_codes) value) codes;
  if coalesce(array_length(normalized_focus, 1), 0) <> jsonb_array_length(p_focus_codes) or exists (select 1 from unnest(coalesce(normalized_focus, '{}'::text[])) code where code not in ('SHOOTING','BALL_HANDLING','PASSING','REBOUNDING','DEFENCE','COMMUNICATION','TEAMWORK','TRANSITION')) or (select count(distinct code) from unnest(coalesce(normalized_focus, '{}'::text[])) code) <> coalesce(array_length(normalized_focus, 1), 0) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  select review.* into old_row from public.post_game_reviews review where review.game_event_id = p_event_id for update;
  select coalesce(array_agg(f.focus_code order by f.focus_code), '{}'::text[]) into old_focus from public.post_game_review_focus f where f.review_id = old_row.id;
  changed := old_row.id is null or old_row.what_worked is distinct from normalized_worked or old_row.needs_improvement is distinct from normalized_improvement or old_focus is distinct from coalesce(normalized_focus, '{}'::text[]) or p_complete is distinct from (old_row.completed_at is not null);
  insert into public.post_game_reviews(game_event_id, club_id, team_id, what_worked, needs_improvement, completed_by, completed_at)
  values (event_row.id, event_row.club_id, event_row.team_id, normalized_worked, normalized_improvement, case when p_complete then actor else null end, case when p_complete then now() else null end)
  on conflict (game_event_id) do update set what_worked = excluded.what_worked, needs_improvement = excluded.needs_improvement,
    completed_by = case when not p_complete then null when changed or post_game_reviews.completed_at is null then actor else post_game_reviews.completed_by end,
    completed_at = case when not p_complete then null when changed or post_game_reviews.completed_at is null then now() else post_game_reviews.completed_at end
  returning * into review_row;
  if old_focus is distinct from coalesce(normalized_focus, '{}'::text[]) then
    delete from public.post_game_review_focus where review_id = review_row.id;
    insert into public.post_game_review_focus(review_id, focus_code) select review_row.id, code from unnest(coalesce(normalized_focus, '{}'::text[])) code;
  end if;
  if changed then
    insert into public.audit_events(club_id, actor_user_id, action, target_id) values (event_row.club_id, actor, case when old_row.id is null then case when p_complete then 'post_game_review.completed' else 'post_game_review.created' end when p_complete and old_row.completed_at is null then 'post_game_review.completed' when not p_complete and old_row.completed_at is not null then 'post_game_review.reopened' else 'post_game_review.updated' end, review_row.id);
  end if;
  return review_row.id;
end;
$$;

create or replace function public.save_player_game_recognition(p_event_id uuid, p_player_id uuid, p_category text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); event_row public.events; rec public.player_game_recognitions; old_note text; old_id uuid; normalized_note text;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, false);
  if p_category not in ('MVP','HUSTLE','DEFENCE','TEAMWORK') or p_category is null or not exists(select 1 from public.player_team_registrations registration where registration.player_id = p_player_id and registration.team_id = event_row.team_id and registration.club_id = event_row.club_id and registration.active) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  normalized_note := nullif(btrim(coalesce(p_note, '')), '');
  if normalized_note is not null and (char_length(normalized_note) > 500 or translate(normalized_note, E'\n', '') ~ '[[:cntrl:]]') then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  select recognition.id, recognition.note into old_id, old_note from public.player_game_recognitions recognition where recognition.game_event_id = event_row.id and recognition.player_id = p_player_id and recognition.category = p_category for update;
  if p_category = 'MVP' and exists(select 1 from public.player_game_recognitions recognition where recognition.game_event_id = event_row.id and recognition.category = 'MVP' and recognition.player_id <> p_player_id) then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  insert into public.player_game_recognitions(game_event_id, club_id, team_id, player_id, category, note, created_by, updated_by)
  values(event_row.id, event_row.club_id, event_row.team_id, p_player_id, p_category, normalized_note, actor, actor)
  on conflict(game_event_id, player_id, category) do update set note = excluded.note, updated_by = actor
  returning * into rec;
  if old_id is null then
    insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'recognition.created', rec.id);
  elsif old_note is distinct from normalized_note then
    insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'recognition.updated', rec.id);
  end if;
  return rec.id;
exception when unique_violation then
  raise exception 'CONFLICT' using errcode = 'P0001';
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
  if removed_id is not null then insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'recognition.removed', removed_id); end if;
end;
$$;

create or replace function public.read_private_player_game_note(p_event_id uuid, p_player_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare event_row public.events; note_value text;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, true);
  if not exists(select 1 from public.player_team_registrations registration where registration.player_id = p_player_id and registration.team_id = event_row.team_id and registration.club_id = event_row.club_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select note.note into note_value from public.private_player_game_notes note where note.game_event_id = event_row.id and note.player_id = p_player_id;
  return note_value;
end;
$$;

create or replace function public.list_private_player_game_notes(p_event_id uuid)
returns table(player_id uuid, note text) language plpgsql security definer set search_path = '' as $$
declare event_row public.events;
begin
  select event.* into event_row from public.events event where event.id = p_event_id and event.event_type = 'GAME' and exists(select 1 from public.games game where game.event_id = event.id);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_post_game_review_actor(event_row.team_id, true);
  return query select private_note.player_id, private_note.note from public.private_player_game_notes private_note where private_note.game_event_id = event_row.id order by private_note.player_id;
end;
$$;

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
    if old_row.game_event_id is not null then insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'private_player_note.cleared', p_player_id); end if;
  else
    if old_row.game_event_id is null then
      insert into public.private_player_game_notes(game_event_id, club_id, team_id, player_id, note, author_user_id, updated_by) values(event_row.id, event_row.club_id, event_row.team_id, p_player_id, normalized_note, actor, actor);
      insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'private_player_note.created', p_player_id);
    elsif old_row.note is distinct from normalized_note then
      update public.private_player_game_notes set note = normalized_note, updated_by = actor where game_event_id = event_row.id and player_id = p_player_id;
      insert into public.audit_events(club_id, actor_user_id, action, target_id) values(event_row.club_id, actor, 'private_player_note.updated', p_player_id);
    end if;
  end if;
end;
$$;

revoke all on function public.assert_post_game_review_actor(uuid, boolean) from public, anon, authenticated;
revoke all on function public.read_post_game_review(uuid) from public, anon, authenticated;
revoke all on function public.save_post_game_review(uuid, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.save_player_game_recognition(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.remove_player_game_recognition(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.read_private_player_game_note(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_private_player_game_notes(uuid) from public, anon, authenticated;
revoke all on function public.save_private_player_game_note(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.read_post_game_review(uuid) to authenticated;
grant execute on function public.save_post_game_review(uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.save_player_game_recognition(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_player_game_recognition(uuid, uuid, text) to authenticated;
grant execute on function public.read_private_player_game_note(uuid, uuid) to authenticated;
grant execute on function public.list_private_player_game_notes(uuid) to authenticated;
grant execute on function public.save_private_player_game_note(uuid, uuid, text) to authenticated;
