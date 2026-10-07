-- M4 Slice 4.3 planner authorization, event/focus tenancy, duration and snapshots.
begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.sqlerrm_of(command text) returns text language plpgsql as $$ begin execute command; return 'OK'; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.assume_user(target uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', target::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', target::text, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
 ('00000000-0000-0000-0000-000000000000','73410000-0000-4000-8000-000000000001','authenticated','authenticated','m4planner-admin@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','73410000-0000-4000-8000-000000000002','authenticated','authenticated','m4planner-coach@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','73410000-0000-4000-8000-000000000003','authenticated','authenticated','m4planner-assistant@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','73410000-0000-4000-8000-000000000004','authenticated','authenticated','m4planner-manager@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','73410000-0000-4000-8000-000000000005','authenticated','authenticated','m4planner-guardian@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','','');
insert into public.profiles(user_id,display_name,first_name,last_name) select id,'Planner User','Planner','User' from auth.users where id between '73410000-0000-4000-8000-000000000001'::uuid and '73410000-0000-4000-8000-000000000005'::uuid;
insert into public.clubs(id,name,slug,timezone,theme_key) values ('73410000-0000-4000-8000-000000000010','Planner Club','m4planner-club','Australia/Melbourne','test');
insert into public.seasons(id,club_id,name) values ('73410000-0000-4000-8000-000000000011','73410000-0000-4000-8000-000000000010','Planner Season');
insert into public.teams(id,club_id,season_id,name,active) values
 ('73410000-0000-4000-8000-000000000012','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000011','Planner Team',true),
 ('73410000-0000-4000-8000-000000000013','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000011','Other Team',true);
insert into public.club_memberships(club_id,user_id,role,active) values ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000001','CLUB_ADMIN',true);
insert into public.team_memberships(club_id,team_id,user_id,role,active) values
 ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','73410000-0000-4000-8000-000000000002','HEAD_COACH',true),
 ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','73410000-0000-4000-8000-000000000003','ASSISTANT_COACH',true),
 ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','73410000-0000-4000-8000-000000000004','TEAM_MANAGER',true);
insert into public.players(id,club_id,first_name,last_name,active) values ('73410000-0000-4000-8000-000000000020','73410000-0000-4000-8000-000000000010','Synthetic','Player',true);
insert into public.guardian_relationships(club_id,player_id,user_id,active) values ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000020','73410000-0000-4000-8000-000000000005',true);
insert into public.player_team_registrations(club_id,team_id,player_id,active) values ('73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','73410000-0000-4000-8000-000000000020',true);
insert into public.events(id,club_id,team_id,event_type,starts_at,ends_at,status) values
 ('73410000-0000-4000-8000-000000000030','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','GAME','2026-09-01 09:00:00+00','2026-09-01 10:00:00+00','COMPLETED'),
 ('73410000-0000-4000-8000-000000000031','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000013','GAME','2026-09-02 09:00:00+00','2026-09-02 10:00:00+00','COMPLETED'),
 ('73410000-0000-4000-8000-000000000032','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','TRAINING','2026-09-03 09:00:00+00','2026-09-03 10:00:00+00','SCHEDULED'),
 ('73410000-0000-4000-8000-000000000033','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','TRAINING','2026-09-04 09:00:00+00',null,'SCHEDULED'),
 ('73410000-0000-4000-8000-000000000034','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000013','TRAINING','2026-09-05 09:00:00+00','2026-09-05 10:00:00+00','SCHEDULED'),
 ('73410000-0000-4000-8000-000000000035','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','TRAINING','2026-09-06 09:00:00+00','2026-09-06 14:00:00+00','SCHEDULED'),
 ('73410000-0000-4000-8000-000000000036','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012','TRAINING','2026-09-07 09:00:00+00',null,'SCHEDULED');
insert into public.games(event_id,club_id,opponent_name,source,official_start_at,fixture_status) values
 ('73410000-0000-4000-8000-000000000030','73410000-0000-4000-8000-000000000010','Opponent','MANUAL','2026-09-01 09:00:00+00','COMPLETED'),
 ('73410000-0000-4000-8000-000000000031','73410000-0000-4000-8000-000000000010','Other Opponent','MANUAL','2026-09-02 09:00:00+00','COMPLETED');
insert into public.post_game_reviews(id,game_event_id,club_id,team_id) values
 ('73410000-0000-4000-8000-000000000040','73410000-0000-4000-8000-000000000030','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000012'),
 ('73410000-0000-4000-8000-000000000041','73410000-0000-4000-8000-000000000031','73410000-0000-4000-8000-000000000010','73410000-0000-4000-8000-000000000013');
insert into public.post_game_review_focus(review_id,focus_code) values ('73410000-0000-4000-8000-000000000040','PASSING'),('73410000-0000-4000-8000-000000000041','DEFENCE');

select no_plan();
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.practice_plans'::regclass),true,'plans force RLS');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.practice_blocks'::regclass),true,'blocks force RLS');
select ok(not has_table_privilege('authenticated','public.practice_plans','select'),'authenticated cannot bypass the scoped planner RPC');
select ok(not has_table_privilege('authenticated','public.private_player_game_notes','select'),'planner cannot read private player-note storage');

do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select lives_ok($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,null,'Reusable passing','','[]','[]')$$,'assistant coach creates reusable template');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,null,'Too long','', '[{"order":1,"duration_minutes":240,"title":"A","instructions":""},{"order":2,"duration_minutes":1,"title":"B","instructions":""}]','[]')$$),'VALIDATION_FAILED','template total is capped at 240 minutes');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000030','Wrong event','','[]','[]')$$),'NOT_FOUND','a GAME cannot own a practice plan');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000034','Other team','','[]','[]')$$),'NOT_FOUND','a plan cannot attach to another team event');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000032','Over duration','', '[{"order":1,"duration_minutes":61,"title":"A","instructions":""}]','[]')$$),'VALIDATION_FAILED','linked plan cannot exceed known event duration');
select lives_ok($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000032','Tuesday practice','', '[{"order":1,"duration_minutes":30,"title":"Passing","instructions":"Move after passing"},{"order":2,"duration_minutes":30,"title":"Spacing","instructions":"Stay wide"}]','[{"source_review_id":"73410000-0000-4000-8000-000000000040","source_event_id":"73410000-0000-4000-8000-000000000030","code":"PASSING"}]')$$,'assistant coach creates bounded training plan with explicit focus snapshot');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000032','Cross team focus','', '[]','[{"source_review_id":"73410000-0000-4000-8000-000000000041","source_event_id":"73410000-0000-4000-8000-000000000031","code":"DEFENCE"}]')$$),'VALIDATION_FAILED','cross-team review focus is rejected');
select lives_ok($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000033','Unknown duration','', '[{"order":1,"duration_minutes":240,"title":"Full practice","instructions":""}]','[]')$$,'unknown scheduled duration permits at most 240 minutes');
select is(pg_temp.sqlerrm_of($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000033','Too long unknown','', '[{"order":1,"duration_minutes":240,"title":"A","instructions":""},{"order":2,"duration_minutes":1,"title":"B","instructions":""}]','[]')$$),'VALIDATION_FAILED','unknown scheduled duration rejects 241 minutes');
select lives_ok($$select public.save_practice_plan('73410000-0000-4000-8000-000000000012',null,'73410000-0000-4000-8000-000000000035','Long training','', '[{"order":1,"duration_minutes":241,"title":"Extended block","instructions":""}]','[]')$$,'known 300-minute training permits a 241-minute plan');
reset role;
select is(pg_temp.sqlerrm_of($$select public.copy_practice_plan('73410000-0000-4000-8000-000000000012',(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000035'),null,true)$$),'VALIDATION_FAILED','copying a 241-minute linked plan to a template rejects the overlong snapshot');

select ok((select count(*)=1 from public.practice_plan_focus where source_review_id='73410000-0000-4000-8000-000000000040' and source_event_id='73410000-0000-4000-8000-000000000030' and focus_code='PASSING'),'focus retains typed source review/event snapshot');
select is((select count(*) from public.practice_blocks where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032')),2::bigint,'saved plan contains both blocks');
select is((select sum(duration_minutes) from public.practice_blocks where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032')),60::bigint,'saved plan total matches the known duration');

-- Reorder persists the block IDs and updates order atomically.
create temporary table planner_ids as select id,sort_order from public.practice_blocks where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032');
do $$ declare p uuid; first_id uuid; second_id uuid; begin
  select id into p from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032';
  select id into first_id from pg_temp.planner_ids where sort_order=1;
  select id into second_id from pg_temp.planner_ids where sort_order=2;
  perform pg_temp.assume_user('73410000-0000-4000-8000-000000000003');
  perform public.save_practice_plan('73410000-0000-4000-8000-000000000012',p,'73410000-0000-4000-8000-000000000032','Tuesday practice','', jsonb_build_array(
    jsonb_build_object('block_id',second_id,'order',1,'duration_minutes',30,'title','Spacing','instructions','Stay wide'),
    jsonb_build_object('block_id',first_id,'order',2,'duration_minutes',30,'title','Passing','instructions','Move after passing')
  ), '[{"source_review_id":"73410000-0000-4000-8000-000000000040","source_event_id":"73410000-0000-4000-8000-000000000030","code":"PASSING"}]');
end $$;
select is((select count(*) from public.practice_blocks b join pg_temp.planner_ids old on old.id=b.id),2::bigint,'reorder preserves stable block identities');
select is((select id from public.practice_blocks where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032') and sort_order=1),(select id from pg_temp.planner_ids where sort_order=2),'reorder changes order without changing the source ID');

do $$ declare p uuid; copied uuid; begin
  select id into p from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032';
  copied := public.copy_practice_plan('73410000-0000-4000-8000-000000000012',p,'73410000-0000-4000-8000-000000000036',false);
  perform pg_temp.assume_user('73410000-0000-4000-8000-000000000003');
end $$;
select is((select count(*) from public.practice_blocks source join public.practice_blocks copied on copied.sort_order=source.sort_order where source.practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032') and copied.practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000036') and source.id=copied.id),0::bigint,'copy snapshots block values with new identities');
select is((select title from public.practice_blocks where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000032') and sort_order=1),'Spacing','copy left source title intact');
select is((select count(*) from public.practice_plan_focus where practice_plan_id=(select id from public.practice_plans where training_event_id='73410000-0000-4000-8000-000000000036') and source_review_id='73410000-0000-4000-8000-000000000040' and focus_code='PASSING'),1::bigint,'template/plan copy snapshots typed focus source');
delete from public.post_game_review_focus where review_id='73410000-0000-4000-8000-000000000040' and focus_code='PASSING';
select is((select count(*) from public.practice_plan_focus where source_review_id='73410000-0000-4000-8000-000000000040' and focus_code='PASSING'),2::bigint,'later source-review edit does not mutate plan focus snapshots');

do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select lives_ok($$select public.read_practice_planner('73410000-0000-4000-8000-000000000012')$$,'Club Admin may read and manage practice plans');
reset role;
do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.read_practice_planner('73410000-0000-4000-8000-000000000012')$$),'FORBIDDEN','Team Manager is excluded');
reset role;
do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000005'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.read_practice_planner('73410000-0000-4000-8000-000000000012')$$),'FORBIDDEN','Guardian is excluded');
reset role;
do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select lives_ok($$select public.save_practice_drill('73410000-0000-4000-8000-000000000012','Shell drill','Close out',12)$$,'assistant coach adds a team drill');
reset role;
select ok((select count(*)=1 from public.drills where team_id='73410000-0000-4000-8000-000000000012' and name='Shell drill'),'drill is scoped to its team');
update public.team_memberships set active=false where user_id='73410000-0000-4000-8000-000000000003' and team_id='73410000-0000-4000-8000-000000000012';
do $$ begin perform pg_temp.assume_user('73410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.read_practice_planner('73410000-0000-4000-8000-000000000012')$$),'FORBIDDEN','revoked assistant coach loses access immediately');
reset role;
select * from finish();
rollback;
