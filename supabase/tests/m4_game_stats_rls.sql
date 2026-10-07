-- M4 Slice 4.1 coaching score/stat security and invariants.
begin;
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.sqlstate_of(command text)
returns text language plpgsql as $$ begin
  execute command; return 'OK';
exception when others then return sqlstate; end $$;
create or replace function pg_temp.sqlerrm_of(command text)
returns text language plpgsql as $$ begin
  execute command; return 'OK';
exception when others then return sqlerrm;
end $$;
create or replace function pg_temp.assume_user(target uuid)
returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', target::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', target::text, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
)
values
 ('00000000-0000-0000-0000-000000000000','71410000-0000-4000-8000-000000000001','authenticated','authenticated','m4-admin@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','71410000-0000-4000-8000-000000000002','authenticated','authenticated','m4-coach@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','71410000-0000-4000-8000-000000000003','authenticated','authenticated','m4-assistant@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','71410000-0000-4000-8000-000000000004','authenticated','authenticated','m4-manager@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','71410000-0000-4000-8000-000000000005','authenticated','authenticated','m4-guardian@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','','');
insert into public.profiles(user_id,display_name,first_name,last_name) values
 ('71410000-0000-4000-8000-000000000001','M4 Admin','M4','Admin'),
 ('71410000-0000-4000-8000-000000000002','M4 Coach','M4','Coach'),
 ('71410000-0000-4000-8000-000000000003','M4 Assistant','M4','Assistant'),
 ('71410000-0000-4000-8000-000000000004','M4 Manager','M4','Manager'),
 ('71410000-0000-4000-8000-000000000005','M4 Guardian','M4','Guardian');
insert into public.clubs(id,name,slug,timezone,theme_key) values
 ('71410000-0000-4000-8000-000000000010','M4 Club','m4-club','Australia/Melbourne','test');
insert into public.seasons(id,club_id,name) values
 ('71410000-0000-4000-8000-000000000011','71410000-0000-4000-8000-000000000010','M4 Season');
insert into public.teams(id,club_id,season_id,name,active) values
 ('71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000011','M4 Team',true),
 ('71410000-0000-4000-8000-000000000013','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000011','M4 Other Team',true);
insert into public.club_memberships(club_id,user_id,role,active) values
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000001','CLUB_ADMIN',true);
insert into public.team_memberships(club_id,team_id,user_id,role,active) values
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000002','HEAD_COACH',true),
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000003','ASSISTANT_COACH',true),
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000004','TEAM_MANAGER',true);
insert into public.players(id,club_id,first_name,last_name,active) values
 ('71410000-0000-4000-8000-000000000020','71410000-0000-4000-8000-000000000010','Synthetic','Child One',true),
 ('71410000-0000-4000-8000-000000000021','71410000-0000-4000-8000-000000000010','Synthetic','Child Two',true);
insert into public.guardian_relationships(club_id,player_id,user_id,active) values
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000020','71410000-0000-4000-8000-000000000005',true);
insert into public.player_team_registrations(club_id,team_id,player_id,active) values
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000020',true),
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','71410000-0000-4000-8000-000000000021',true);
insert into public.events(id,club_id,team_id,event_type,starts_at,ends_at,status) values
 ('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','GAME','2026-09-01 09:00:00+00','2026-09-01 09:40:00+00','COMPLETED'),
 ('71410000-0000-4000-8000-000000000031','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','GAME','2026-09-02 09:00:00+00',null,'COMPLETED'),
 ('71410000-0000-4000-8000-000000000032','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000013','GAME','2026-09-03 09:00:00+00','2026-09-03 09:40:00+00','COMPLETED'),
 ('71410000-0000-4000-8000-000000000033','71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','GAME','2026-09-04 09:00:00+00','2026-09-04 12:00:00+00','COMPLETED');
insert into public.games(event_id,club_id,opponent_name,source,official_start_at,fixture_status,external_id) values
 ('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000010','Opponent','MANUAL','2026-09-01 09:00:00+00','COMPLETED',null),
 ('71410000-0000-4000-8000-000000000031','71410000-0000-4000-8000-000000000010','Imported Opponent','IMPORT','2026-09-02 09:00:00+00','COMPLETED','external-31'),
 ('71410000-0000-4000-8000-000000000032','71410000-0000-4000-8000-000000000010','Other Team Opponent','MANUAL','2026-09-03 09:00:00+00','COMPLETED',null),
 ('71410000-0000-4000-8000-000000000033','71410000-0000-4000-8000-000000000010','Long Scheduled Game','MANUAL','2026-09-04 09:00:00+00','COMPLETED',null);
insert into public.game_team_overlay(game_event_id) values
 ('71410000-0000-4000-8000-000000000030'),('71410000-0000-4000-8000-000000000031'),('71410000-0000-4000-8000-000000000032'),('71410000-0000-4000-8000-000000000033');

select no_plan();
select has_table('public','game_player_stats','Stable-owned player stats table exists');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.game_player_stats'::regclass),true,'stats table forces RLS');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.game_player_stat_revisions'::regclass),true,'restricted revision table forces RLS');
set local role authenticated;
select is(pg_temp.sqlstate_of($$select * from public.game_player_stats$$),'42501','authenticated cannot read stats through the base table');
select is(pg_temp.sqlstate_of($$select * from public.game_player_stat_revisions$$),'42501','authenticated cannot read restricted correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select lives_ok($$select public.save_manual_game_result('71410000-0000-4000-8000-000000000030', 72, 68)$$,'assistant coach may write manual score');
select is(pg_temp.sqlerrm_of($$select public.save_manual_game_result('71410000-0000-4000-8000-000000000030', 251, 68)$$),'VALIDATION_FAILED','score is bounded to 250');
select is(pg_temp.sqlerrm_of($$select public.save_manual_game_result('71410000-0000-4000-8000-000000000031', 72, 68)$$),'FORBIDDEN','manual score command refuses imported official result');
select lives_ok($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000020',12,5,3,1,2,40)$$,'assistant coach may create registered player stat line');
set local role service_role;
select is(pg_temp.sqlerrm_of($$update public.events set ends_at=starts_at + interval '39 minutes' where id='71410000-0000-4000-8000-000000000030'$$),'VALIDATION_FAILED','schedule cannot be shortened below an existing stat minutes value');
reset role;
select is((select recorded_by from public.game_player_stats where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),'71410000-0000-4000-8000-000000000003'::uuid,'stat line retains its original recorder');
select is((select updated_by from public.game_player_stats where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),'71410000-0000-4000-8000-000000000003'::uuid,'new stat line records its current actor as updater');
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000021',1,0,0,0,0,41)$$),'VALIDATION_FAILED','known scheduled duration caps minutes');
select lives_ok($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000033','71410000-0000-4000-8000-000000000020',1,0,0,0,0,121)$$,'scheduled 180-minute game accepts 121 approximate minutes');
select is(pg_temp.sqlerrm_of($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000031','71410000-0000-4000-8000-000000000020',1,0,0,0,0,121)$$),'VALIDATION_FAILED','unknown scheduled duration keeps the 120-minute cap');
select lives_ok($$select * from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')$$,'active assistant coach may read scoped correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_manual_game_result('71410000-0000-4000-8000-000000000032',1,0)$$),'FORBIDDEN','coach cannot write a different team game');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_manual_game_result('71410000-0000-4000-8000-000000000030',1,0)$$),'FORBIDDEN','team manager cannot write M4 scores');
select is(pg_temp.sqlerrm_of($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000020',1,0,0,0,0,1)$$),'FORBIDDEN','team manager cannot write M4 stats');
select lives_ok($$select public.update_official_fixture('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000012','2026-09-01 09:00:00+00','2026-09-01 09:40:00+00',null,null,null,null,'Metadata changed','2026-09-01 09:00:00+00',null,null,null,'71410000-0000-4000-8000-000000000030','COMPLETED',null,null,null)$$,'manager may still edit manual fixture metadata');
reset role;
select is((select team_score from public.games where event_id='71410000-0000-4000-8000-000000000030'),72,'legacy metadata edit preserves team score');
select is((select opponent_score from public.games where event_id='71410000-0000-4000-8000-000000000030'),68,'legacy metadata edit preserves opponent score');

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000020',101,0,0,0,0,1)$$),'VALIDATION_FAILED','stat integer bounds are enforced');
reset role;
update public.player_team_registrations set active=false
where team_id='71410000-0000-4000-8000-000000000012'
  and player_id in ('71410000-0000-4000-8000-000000000020','71410000-0000-4000-8000-000000000021');
insert into public.player_team_registrations(club_id,team_id,player_id,active) values
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000013','71410000-0000-4000-8000-000000000020',true),
 ('71410000-0000-4000-8000-000000000010','71410000-0000-4000-8000-000000000013','71410000-0000-4000-8000-000000000021',true);
set local role authenticated;
select lives_ok($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000020',13,5,3,1,2,39)$$,'current game-team coach can correct transferred historical line');
select is((select count(*) from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')),1::bigint,'active head coach reads game correction history');
reset role;
select is((select count(*) from public.game_player_stat_revisions where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),1::bigint,'correction appends revision');
select is((select actor_user_id from public.game_player_stat_revisions where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),'71410000-0000-4000-8000-000000000002'::uuid,'revision stores actor id');
select is(
  pg_temp.sqlerrm_of($$update public.game_player_stat_revisions set before_points=0 where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'$$),
  'IMMUTABLE',
  'stat correction revisions cannot be edited'
);
select is(
  pg_temp.sqlerrm_of($$delete from public.game_player_stat_revisions where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'$$),
  'IMMUTABLE',
  'stat correction revisions cannot be deleted'
);

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select lives_ok($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000020',14,5,3,1,2,38)$$,'Club Admin retains authorized correction access after transfer');
reset role;
select is((select recorded_by from public.game_player_stats where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),'71410000-0000-4000-8000-000000000003'::uuid,'corrections preserve the original recorder');
select is((select updated_by from public.game_player_stats where game_event_id='71410000-0000-4000-8000-000000000030' and player_id='71410000-0000-4000-8000-000000000020'),'71410000-0000-4000-8000-000000000001'::uuid,'correction records the most recent actor');
set local role authenticated;
select is((select count(*) from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')),2::bigint,'Club Admin reads correction history via capability matrix');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select is((select count(*) from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')),2::bigint,'active assistant coach may read existing correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','team manager cannot read correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000032')$$),'FORBIDDEN','coach cannot read another team game correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000005'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_game_coaching_stats('71410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','guardian cannot read coaching stats');
select is(pg_temp.sqlerrm_of($$select * from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','guardian cannot read correction history');
reset role;

do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_game_player_stat('71410000-0000-4000-8000-000000000030','71410000-0000-4000-8000-000000000021',1,0,0,0,0,1)$$),'FORBIDDEN','new stat cannot be created after player transfer');
reset role;

update public.team_memberships set active=false
where user_id='71410000-0000-4000-8000-000000000003'
  and team_id='71410000-0000-4000-8000-000000000012';
do $$ begin perform pg_temp.assume_user('71410000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.read_game_coaching_stats('71410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','revoked coach loses access immediately');
select is(pg_temp.sqlerrm_of($$select * from public.read_game_player_stat_history('71410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','revoked coach loses correction history access immediately');
reset role;

select is((select action from public.audit_events where action='game.result_saved' and target_id='71410000-0000-4000-8000-000000000030'),'game.result_saved','score save has opaque generic audit target');
select is((select count(*) from public.audit_events where action='game_player_stats.corrected' and target_id='71410000-0000-4000-8000-000000000020'),2::bigint,'correction audits reference only opaque player id');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='game_player_stat_revisions' and column_name ilike '%name%'),0::bigint,'revision history has no name column');
select is(pg_get_function_result('public.read_game_player_stat_history(uuid)'::regprocedure) ~* 'name',false,'history read RPC exposes no name field');
select * from finish();
rollback;
