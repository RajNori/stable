-- M4 Slice 4.3. Team-scoped thin practice plans and reusable templates.
-- All authenticated access uses explicit RPCs; source focus is copied as a typed snapshot.

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (
  action in (
    'season.created', 'season.updated', 'competition.created', 'competition.updated',
    'team.created', 'team.updated', 'venue.created', 'venue.updated', 'player.created',
    'player.imported', 'player.updated', 'player.deactivated', 'player.reactivated',
    'guardian.linked', 'guardian.unlinked', 'team_staff.assigned', 'team_staff.revoked',
    'team_staff.reactivated', 'player_team.registered', 'player_team.unregistered',
    'invitation.created', 'invitation.revoked', 'invitation.accepted', 'fixture.created',
    'fixture.imported', 'fixture.official_updated', 'fixture.overlay_updated', 'duty.assigned',
    'attendance.recorded', 'training.created', 'training.series_created', 'training.updated',
    'training.checked_in', 'announcement.published', 'announcement.updated', 'announcement.archived',
    'announcement.acknowledged', 'duty.acknowledged', 'duty.allocated', 'duty.swap_requested',
    'duty.swap_accepted', 'duty.swap_cancelled', 'fill_in.requested', 'fill_in.responded',
    'fill_in.confirmed', 'game.result_saved', 'game_player_stats.created', 'game_player_stats.corrected',
    'post_game_review.created', 'post_game_review.updated', 'post_game_review.completed',
    'post_game_review.reopened', 'recognition.created', 'recognition.updated', 'recognition.removed',
    'private_player_note.created', 'private_player_note.updated', 'private_player_note.cleared',
    'practice_plan.created', 'practice_plan.updated', 'practice_plan.copied', 'practice_drill.created'
  )
);

create table public.drills (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  team_id uuid not null,
  name text not null,
  instructions text not null default '',
  default_duration_minutes integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint drills_team_club_fkey foreign key (team_id, club_id) references public.teams(id, club_id),
  constraint drills_name_check check (char_length(name) between 1 and 120 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  constraint drills_instructions_check check (char_length(instructions) <= 2000 and instructions = btrim(instructions)),
  constraint drills_duration_check check (default_duration_minutes is null or default_duration_minutes between 1 and 240),
  constraint drills_id_team_club_key unique (id, team_id, club_id)
);

create table public.practice_plans (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  team_id uuid not null,
  training_event_id uuid,
  is_template boolean not null,
  title text not null,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_plans_team_club_fkey foreign key (team_id, club_id) references public.teams(id, club_id),
  constraint practice_plans_event_fkey foreign key (training_event_id, team_id, club_id) references public.events(id, team_id, club_id),
  constraint practice_plans_template_event_check check ((is_template and training_event_id is null) or (not is_template and training_event_id is not null)),
  constraint practice_plans_title_check check (char_length(title) between 1 and 120 and title = btrim(title) and title !~ '[[:cntrl:]]'),
  constraint practice_plans_notes_check check (char_length(notes) <= 2000 and notes = btrim(notes)),
  constraint practice_plans_event_unique unique (training_event_id),
  constraint practice_plans_id_team_club_key unique (id, team_id, club_id)
);

create table public.practice_blocks (
  id uuid primary key default gen_random_uuid(),
  practice_plan_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  sort_order integer not null,
  drill_id uuid,
  title text,
  duration_minutes integer not null,
  instructions text not null default '',
  constraint practice_blocks_plan_fkey foreign key (practice_plan_id, team_id, club_id) references public.practice_plans(id, team_id, club_id) on delete cascade,
  constraint practice_blocks_drill_fkey foreign key (drill_id, team_id, club_id) references public.drills(id, team_id, club_id),
  constraint practice_blocks_order_check check (sort_order between 1 and 50),
  constraint practice_blocks_duration_check check (duration_minutes > 0),
  constraint practice_blocks_source_check check ((drill_id is not null and title is null) or (drill_id is null and title is not null and char_length(title) between 1 and 120 and title = btrim(title) and title !~ '[[:cntrl:]]')),
  constraint practice_blocks_instructions_check check (char_length(instructions) <= 2000 and instructions = btrim(instructions)),
  constraint practice_blocks_order_unique unique (practice_plan_id, sort_order) deferrable initially deferred,
  constraint practice_blocks_id_plan_key unique (id, practice_plan_id)
);

create table public.practice_plan_focus (
  practice_plan_id uuid not null,
  team_id uuid not null,
  club_id uuid not null,
  source_review_id uuid not null,
  source_event_id uuid not null,
  focus_code text not null check (focus_code in ('SHOOTING','BALL_HANDLING','PASSING','REBOUNDING','DEFENCE','COMMUNICATION','TEAMWORK','TRANSITION')),
  created_at timestamptz not null default now(),
  primary key (practice_plan_id, source_review_id, focus_code),
  constraint practice_plan_focus_plan_fkey foreign key (practice_plan_id, team_id, club_id) references public.practice_plans(id, team_id, club_id) on delete cascade,
  constraint practice_plan_focus_review_fkey foreign key (source_review_id) references public.post_game_reviews(id),
  constraint practice_plan_focus_event_fkey foreign key (source_event_id, team_id, club_id) references public.events(id, team_id, club_id)
);

create index practice_plans_team_template_idx on public.practice_plans(team_id, is_template, updated_at desc);
create index practice_blocks_plan_order_idx on public.practice_blocks(practice_plan_id, sort_order);
create trigger practice_plans_set_updated_at before update on public.practice_plans for each row execute function public.set_updated_at();

alter table public.drills enable row level security;
alter table public.drills force row level security;
alter table public.practice_plans enable row level security;
alter table public.practice_plans force row level security;
alter table public.practice_blocks enable row level security;
alter table public.practice_blocks force row level security;
alter table public.practice_plan_focus enable row level security;
alter table public.practice_plan_focus force row level security;
revoke all on table public.drills, public.practice_plans, public.practice_blocks, public.practice_plan_focus from public, anon, authenticated;
grant select, insert, update, delete on table public.drills, public.practice_plans, public.practice_blocks, public.practice_plan_focus to service_role;

create or replace function public.assert_practice_plan_actor(p_team_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); team_row public.teams;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select team.* into team_row from public.teams team where team.id = p_team_id and team.active;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if public.caller_is_club_admin(team_row.club_id) or exists (
    select 1 from public.team_memberships membership where membership.team_id = team_row.id
      and membership.club_id = team_row.club_id and membership.user_id = actor and membership.active
      and membership.role in ('HEAD_COACH','ASSISTANT_COACH')
  ) then return; end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end;
$$;

create or replace function public.read_practice_planner(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare team_row public.teams; result jsonb;
begin
  select team.* into team_row from public.teams team where team.id = p_team_id and team.active;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.assert_practice_plan_actor(team_row.id);
  select jsonb_build_object(
    'trainings', coalesce((select jsonb_agg(jsonb_build_object(
      'event_id', event.id, 'starts_at', event.starts_at, 'ends_at', event.ends_at,
      'plan', (select public.practice_plan_json(plan.id) from public.practice_plans plan where plan.training_event_id = event.id)
    ) order by event.starts_at) from public.events event where event.team_id = team_row.id and event.club_id = team_row.club_id and event.event_type = 'TRAINING' and event.status <> 'CANCELLED'), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(public.practice_plan_json(plan.id) order by plan.updated_at desc) from public.practice_plans plan where plan.team_id = team_row.id and plan.club_id = team_row.club_id and plan.is_template), '[]'::jsonb),
    'focus_sources', coalesce((select jsonb_agg(jsonb_build_object('source_review_id', review.id, 'source_event_id', event.id, 'code', focus.focus_code, 'reviewed_at', review.updated_at) order by review.updated_at desc, focus.focus_code) from public.post_game_reviews review join public.events event on event.id = review.game_event_id join public.post_game_review_focus focus on focus.review_id = review.id where event.team_id = team_row.id and event.club_id = team_row.club_id and event.event_type = 'GAME' and event.status <> 'CANCELLED' and exists(select 1 from public.games game where game.event_id = event.id)), '[]'::jsonb),
    'drills', coalesce((select jsonb_agg(jsonb_build_object('drill_id', drill.id, 'name', drill.name) order by drill.name) from public.drills drill where drill.team_id = team_row.id and drill.club_id = team_row.club_id and drill.active), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.practice_plan_json(p_plan_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan_id', plan.id, 'training_event_id', plan.training_event_id, 'is_template', plan.is_template,
    'title', plan.title, 'notes', plan.notes,
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('block_id', block.id, 'order', block.sort_order, 'duration_minutes', block.duration_minutes, 'drill_id', block.drill_id, 'title', block.title, 'instructions', block.instructions) order by block.sort_order) from public.practice_blocks block where block.practice_plan_id = plan.id), '[]'::jsonb),
    'focus', coalesce((select jsonb_agg(jsonb_build_object('source_review_id', focus.source_review_id, 'source_event_id', focus.source_event_id, 'code', focus.focus_code) order by focus.source_event_id, focus.focus_code) from public.practice_plan_focus focus where focus.practice_plan_id = plan.id), '[]'::jsonb)
  ) from public.practice_plans plan where plan.id = p_plan_id;
$$;

create or replace function public.save_practice_plan(p_team_id uuid, p_plan_id uuid, p_training_event_id uuid, p_title text, p_notes text, p_blocks jsonb, p_focus jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); team_row public.teams; event_row public.events; plan_row public.practice_plans; plan_id_value uuid; total_minutes numeric; block jsonb; focus_item jsonb; block_id_value uuid; expected_count integer;
begin
  perform public.assert_practice_plan_actor(p_team_id);
  select team.* into team_row from public.teams team where team.id = p_team_id and team.active;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 or translate(btrim(p_title), E'\n', '') ~ '[[:cntrl:]]' or p_notes is null or char_length(btrim(p_notes)) > 2000 or p_blocks is null or jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 50 or p_focus is null or jsonb_typeof(p_focus) <> 'array' or jsonb_array_length(p_focus) > 5 then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if p_training_event_id is not null then
    select event.* into event_row from public.events event where event.id = p_training_event_id and event.team_id = team_row.id and event.club_id = team_row.club_id and event.event_type = 'TRAINING' and event.status <> 'CANCELLED' for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  if p_plan_id is not null then
    select plan.* into plan_row from public.practice_plans plan where plan.id = p_plan_id and plan.team_id = team_row.id and plan.club_id = team_row.club_id for update;
    if not found or plan_row.training_event_id is distinct from p_training_event_id or plan_row.is_template <> (p_training_event_id is null) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  select coalesce(sum((item->>'duration_minutes')::integer), 0), count(*) into total_minutes, expected_count from jsonb_array_elements(p_blocks) item
    where item ? 'duration_minutes' and item->>'duration_minutes' ~ '^[0-9]+$';
  if expected_count <> jsonb_array_length(p_blocks) or exists(select 1 from jsonb_array_elements(p_blocks) item where (item->>'duration_minutes')::integer < 1 or (item->>'order') !~ '^[0-9]+$') then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_blocks) item group by (item->>'order') having count(*) > 1) or (jsonb_array_length(p_blocks) > 0 and (select count(distinct (item->>'order')::integer) from jsonb_array_elements(p_blocks) item) <> jsonb_array_length(p_blocks)) or exists(select 1 from jsonb_array_elements(p_blocks) item where (item->>'order')::integer < 1 or (item->>'order')::integer > 50) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_blocks) item where ((nullif(item->>'drill_id','') is null) = (nullif(btrim(item->>'title'),'') is null)) or char_length(coalesce(item->>'title','')) > 120 or char_length(coalesce(item->>'instructions','')) > 2000) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_blocks) item where item->>'drill_id' is not null and not exists(select 1 from public.drills drill where drill.id = (item->>'drill_id')::uuid and drill.team_id = team_row.id and drill.club_id = team_row.club_id and drill.active)) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if total_minutes > case when event_row.id is null or event_row.ends_at is null then 240 else floor(extract(epoch from (event_row.ends_at - event_row.starts_at)) / 60)::numeric end then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_focus) item where not (item->>'code' = any(array['SHOOTING','BALL_HANDLING','PASSING','REBOUNDING','DEFENCE','COMMUNICATION','TEAMWORK','TRANSITION'])) or not exists(
      select 1 from public.post_game_reviews review join public.events source_event on source_event.id = review.game_event_id
      join public.post_game_review_focus source_focus on source_focus.review_id = review.id
      where review.id = (item->>'source_review_id')::uuid and source_event.id = (item->>'source_event_id')::uuid
        and source_event.team_id = team_row.id and source_event.club_id = team_row.club_id
        and source_event.event_type = 'GAME' and source_event.status <> 'CANCELLED'
        and exists(select 1 from public.games source_game where source_game.event_id = source_event.id)
        and source_focus.focus_code = item->>'code'
    )) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_focus) item group by item->>'source_review_id', item->>'code' having count(*) > 1) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;

  if p_plan_id is null then
    insert into public.practice_plans(club_id, team_id, training_event_id, is_template, title, notes, created_by, updated_by)
      values(team_row.club_id, team_row.id, p_training_event_id, p_training_event_id is null, btrim(p_title), btrim(p_notes), actor, actor) returning id into plan_id_value;
  else
    plan_id_value := p_plan_id;
    update public.practice_plans set title = btrim(p_title), notes = btrim(p_notes), updated_by = actor where id = plan_id_value;
  end if;
  -- Existing block IDs are accepted only if they already belong to this plan.
  for block in select value from jsonb_array_elements(p_blocks) loop
    block_id_value := nullif(block->>'block_id','')::uuid;
    if block_id_value is not null and not exists(select 1 from public.practice_blocks where id = block_id_value and practice_plan_id = plan_id_value) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
  end loop;
  delete from public.practice_blocks where practice_plan_id = plan_id_value;
  -- Reorder, add and remove happen in one transaction; supplied owned identities remain stable.
  for block in select value from jsonb_array_elements(p_blocks) order by (value->>'order')::integer loop
    insert into public.practice_blocks(id, practice_plan_id, club_id, team_id, sort_order, drill_id, title, duration_minutes, instructions)
      values(coalesce(nullif(block->>'block_id','')::uuid, gen_random_uuid()), plan_id_value, team_row.club_id, team_row.id, (block->>'order')::integer, nullif(block->>'drill_id','')::uuid, nullif(btrim(block->>'title'),''), (block->>'duration_minutes')::integer, btrim(coalesce(block->>'instructions','')));
  end loop;
  delete from public.practice_plan_focus where practice_plan_id = plan_id_value;
  for focus_item in select value from jsonb_array_elements(p_focus) loop
    insert into public.practice_plan_focus(practice_plan_id, team_id, club_id, source_review_id, source_event_id, focus_code)
      values(plan_id_value, team_row.id, team_row.club_id, (focus_item->>'source_review_id')::uuid, (focus_item->>'source_event_id')::uuid, focus_item->>'code');
  end loop;
  insert into public.audit_events(club_id, actor_user_id, action, target_id)
    values(team_row.club_id, actor, case when p_plan_id is null then 'practice_plan.created' else 'practice_plan.updated' end, plan_id_value);
  return plan_id_value;
end;
$$;

create or replace function public.copy_practice_plan(p_team_id uuid, p_source_plan_id uuid, p_training_event_id uuid, p_as_template boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); team_row public.teams; source_row public.practice_plans; target_event public.events; new_plan_id uuid;
begin
  perform public.assert_practice_plan_actor(p_team_id);
  select team.* into team_row from public.teams team where team.id = p_team_id and team.active;
  select plan.* into source_row from public.practice_plans plan where plan.id = p_source_plan_id and plan.team_id = team_row.id and plan.club_id = team_row.club_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_as_template is null or (p_as_template and p_training_event_id is not null) or (not p_as_template and p_training_event_id is null) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  if p_training_event_id is not null then
    select event.* into target_event from public.events event where event.id = p_training_event_id and event.team_id = team_row.id and event.club_id = team_row.club_id and event.event_type = 'TRAINING' and event.status <> 'CANCELLED' for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if exists(select 1 from public.practice_plans where training_event_id = p_training_event_id) then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  end if;
  if (select coalesce(sum(duration_minutes),0) from public.practice_blocks where practice_plan_id = source_row.id) > case when p_training_event_id is null or target_event.ends_at is null then 240 else floor(extract(epoch from (target_event.ends_at - target_event.starts_at)) / 60)::numeric end then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  insert into public.practice_plans(club_id, team_id, training_event_id, is_template, title, notes, created_by, updated_by)
    values(team_row.club_id, team_row.id, p_training_event_id, p_as_template, source_row.title, source_row.notes, actor, actor) returning id into new_plan_id;
  insert into public.practice_blocks(practice_plan_id, club_id, team_id, sort_order, drill_id, title, duration_minutes, instructions)
    select new_plan_id, team_row.club_id, team_row.id, sort_order, drill_id, title, duration_minutes, instructions from public.practice_blocks where practice_plan_id = source_row.id order by sort_order;
  insert into public.practice_plan_focus(practice_plan_id, team_id, club_id, source_review_id, source_event_id, focus_code)
    select new_plan_id, team_row.id, team_row.club_id, source_review_id, source_event_id, focus_code from public.practice_plan_focus where practice_plan_id = source_row.id;
  insert into public.audit_events(club_id, actor_user_id, action, target_id) values(team_row.club_id, actor, 'practice_plan.copied', new_plan_id);
  return new_plan_id;
end;
$$;

create or replace function public.save_practice_drill(p_team_id uuid, p_name text, p_instructions text, p_default_duration_minutes integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); team_row public.teams; drill_id_value uuid;
begin
  perform public.assert_practice_plan_actor(p_team_id);
  select team.* into team_row from public.teams team where team.id = p_team_id and team.active;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or translate(btrim(p_name), E'\n', '') ~ '[[:cntrl:]]' or p_instructions is null or char_length(btrim(p_instructions)) > 2000 or (p_default_duration_minutes is not null and p_default_duration_minutes not between 1 and 240) then raise exception 'VALIDATION_FAILED' using errcode = '23514'; end if;
  insert into public.drills(club_id, team_id, name, instructions, default_duration_minutes)
    values(team_row.club_id, team_row.id, btrim(p_name), btrim(p_instructions), p_default_duration_minutes) returning id into drill_id_value;
  insert into public.audit_events(club_id, actor_user_id, action, target_id) values(team_row.club_id, actor, 'practice_drill.created', drill_id_value);
  return drill_id_value;
end;
$$;

revoke all on function public.assert_practice_plan_actor(uuid) from public, anon, authenticated;
revoke all on function public.practice_plan_json(uuid) from public, anon, authenticated;
revoke all on function public.read_practice_planner(uuid) from public, anon, authenticated;
revoke all on function public.save_practice_plan(uuid,uuid,uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.copy_practice_plan(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.save_practice_drill(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.read_practice_planner(uuid), public.save_practice_plan(uuid,uuid,uuid,text,text,jsonb,jsonb), public.copy_practice_plan(uuid,uuid,uuid,boolean), public.save_practice_drill(uuid,text,text,integer) to authenticated;
