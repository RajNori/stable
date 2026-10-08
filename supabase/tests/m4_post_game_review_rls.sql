-- M4 Slice 4.2: review lifecycle, recognition invariants, and private-note boundary.
begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.sqlerrm_of(command text) returns text language plpgsql as $$ begin execute command; return 'OK'; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.assume_user(target uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', target::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', target::text, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000001','authenticated','authenticated','m4review-admin@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000002','authenticated','authenticated','m4review-coach@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000003','authenticated','authenticated','m4review-assistant@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000004','authenticated','authenticated','m4review-manager@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000005','authenticated','authenticated','m4review-guardian@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000006','authenticated','authenticated','m4review-dual@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','72410000-0000-4000-8000-000000000007','authenticated','authenticated','m4review-outsider@local.test','','2026-10-01','{"provider":"email"}','{}',now(),now(),'','','','');
insert into public.profiles(user_id,display_name,first_name,last_name) select id,'Review User','Review','User' from auth.users where id between '72410000-0000-4000-8000-000000000001'::uuid and '72410000-0000-4000-8000-000000000007'::uuid;
insert into public.clubs(id,name,slug,timezone,theme_key) values ('72410000-0000-4000-8000-000000000010','Review Club','m4review-club','Australia/Melbourne','test');
insert into public.seasons(id,club_id,name) values ('72410000-0000-4000-8000-000000000011','72410000-0000-4000-8000-000000000010','Review Season');
insert into public.teams(id,club_id,season_id,name,active) values
 ('72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000011','Review Team',true),
 ('72410000-0000-4000-8000-000000000013','72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000011','Other Team',true);
insert into public.club_memberships(club_id,user_id,role,active) values
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000001','CLUB_ADMIN',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000006','CLUB_ADMIN',true);
insert into public.team_memberships(club_id,team_id,user_id,role,active) values
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000002','HEAD_COACH',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000003','ASSISTANT_COACH',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000004','TEAM_MANAGER',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000006','ASSISTANT_COACH',true);
insert into public.players(id,club_id,first_name,last_name,active) values
 ('72410000-0000-4000-8000-000000000020','72410000-0000-4000-8000-000000000010','Synthetic','Player One',true),
 ('72410000-0000-4000-8000-000000000021','72410000-0000-4000-8000-000000000010','Synthetic','Player Two',true);
insert into public.guardian_relationships(club_id,player_id,user_id,active) values
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000020','72410000-0000-4000-8000-000000000005',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000020','72410000-0000-4000-8000-000000000006',true);
insert into public.player_team_registrations(club_id,team_id,player_id,active) values
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000020',true),
 ('72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','72410000-0000-4000-8000-000000000021',true);
insert into public.events(id,club_id,team_id,event_type,starts_at,ends_at,status) values
 ('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','GAME','2026-09-01 09:00:00+00','2026-09-01 10:00:00+00','COMPLETED'),
 ('72410000-0000-4000-8000-000000000031','72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000013','GAME','2026-09-02 09:00:00+00','2026-09-02 10:00:00+00','COMPLETED'),
 ('72410000-0000-4000-8000-000000000032','72410000-0000-4000-8000-000000000010','72410000-0000-4000-8000-000000000012','TRAINING','2026-09-03 09:00:00+00','2026-09-03 10:00:00+00','COMPLETED');
insert into public.games(event_id,club_id,opponent_name,source,official_start_at,fixture_status) values
 ('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000010','Opponent','MANUAL','2026-09-01 09:00:00+00','COMPLETED'),
 ('72410000-0000-4000-8000-000000000031','72410000-0000-4000-8000-000000000010','Other Opponent','MANUAL','2026-09-02 09:00:00+00','COMPLETED');

select no_plan();
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.post_game_reviews'::regclass),true,'review table forces RLS');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.private_player_game_notes'::regclass),true,'private notes force RLS');
select ok(not has_function_privilege('anon','public.read_post_game_review(uuid)','EXECUTE'),'anonymous role cannot execute review RPC');
select ok(not has_function_privilege('anon','public.read_private_player_game_note(uuid,uuid)','EXECUTE'),'anonymous role cannot execute private-note RPC');
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000007'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','authenticated outsider cannot read review');
select is(pg_temp.sqlerrm_of($$select public.save_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','outsider')$$),'FORBIDDEN','authenticated outsider cannot write private notes');
reset role;
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select ok(not has_table_privilege('authenticated','public.private_player_game_notes','select'),'coach cannot bypass note RPC');
select lives_ok($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Good passing','Box out','["PASSING","TEAMWORK"]',false)$$,'head coach saves a draft with typed focus');
select lives_ok($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Good passing','Box out','["PASSING","TEAMWORK"]',true)$$,'head coach explicitly completes review');
select lives_ok($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Good passing','Box out','["PASSING","TEAMWORK"]',true)$$,'identical completion retry succeeds idempotently');
select is((select count(*) from public.audit_events where action like 'post_game_review.%' and team_id='72410000-0000-4000-8000-000000000012'),2::bigint,'active head coach reads review audit metadata for the assigned team');
select lives_ok($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Good passing','Box out earlier','["PASSING","TEAMWORK"]',false)$$,'editing review reopens completion');
reset role;
select is((select completed_at from public.post_game_reviews where game_event_id='72410000-0000-4000-8000-000000000030'),null,'reopened review clears completion metadata');
set local role authenticated;
select lives_ok($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Good passing','Box out earlier','["PASSING","TEAMWORK"]',true)$$,'authorized writer can re-complete edited review');
reset role;
select is((select completed_by from public.post_game_reviews where game_event_id='72410000-0000-4000-8000-000000000030'),'72410000-0000-4000-8000-000000000002'::uuid,'completion records actor');
select is((select count(*) from public.post_game_review_focus where review_id=(select id from public.post_game_reviews where game_event_id='72410000-0000-4000-8000-000000000030')),2::bigint,'review has two explicitly selected focus codes');
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','','','["PASSING","PASSING"]',false)$$),'VALIDATION_FAILED','duplicate focus is rejected');
select is(pg_temp.sqlerrm_of($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','','','["BOGUS"]',false)$$),'VALIDATION_FAILED','unknown focus is rejected');
select is(pg_temp.sqlerrm_of($$select public.save_post_game_review('72410000-0000-4000-8000-000000000032','','','[]',false)$$),'NOT_FOUND','training event cannot receive a game review');
select lives_ok($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','MVP','Strong leadership')$$,'coach awards MVP');
select lives_ok($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','TEAMWORK',null)$$,'coach awards another category to same player');
select lives_ok($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000021','TEAMWORK',null)$$,'same recognition category may go to another player');
select is(pg_temp.sqlerrm_of($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000021','MVP',null)$$),'CONFLICT','only one MVP recipient per game');
reset role;
select is((select count(*) from public.player_game_recognitions where game_event_id='72410000-0000-4000-8000-000000000030' and player_id='72410000-0000-4000-8000-000000000020' and category='TEAMWORK'),1::bigint,'recognition retry remains one logical row');
set local role authenticated;
select lives_ok($$select public.save_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','Private confidence note')$$,'head coach writes distinct private note');
select is(public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020'),'Private confidence note','head coach reads private note through separate RPC');
select is((select count(*) from public.read_post_game_review('72410000-0000-4000-8000-000000000030')),1::bigint,'review projection remains independently readable');
select is((select count(*) from public.read_post_game_review('72410000-0000-4000-8000-000000000030') where recognitions::text like '%Private confidence note%'),0::bigint,'review projection never includes private note text');
reset role;

do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','Club Admin without coach membership cannot read team review');
select is(pg_temp.sqlerrm_of($$select public.save_post_game_review('72410000-0000-4000-8000-000000000030','Admin attempt','','[]',false)$$),'FORBIDDEN','Club Admin without coach membership cannot write team review');
select is(pg_temp.sqlerrm_of($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','HUSTLE',null)$$),'FORBIDDEN','Club Admin without coach membership cannot write recognition');
select is(pg_temp.sqlerrm_of($$select public.remove_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','MVP')$$),'FORBIDDEN','Club Admin without coach membership cannot remove recognition');
select is(pg_temp.sqlerrm_of($$select public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020')$$),'FORBIDDEN','Club Admin without coach membership cannot read private note');
select is(pg_temp.sqlerrm_of($$select public.save_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','no')$$),'FORBIDDEN','Club Admin without coach membership cannot write private note');
select is((select count(*) from public.audit_events where action like 'private_player_note.%'),0::bigint,'Club Admin without coach membership cannot read private-note audit metadata');
select is((select count(*) from public.audit_events where action like 'post_game_review.%'),0::bigint,'Club Admin without coach membership cannot read review audit metadata');
reset role;

do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000006'); end $$;
set local role authenticated;
select lives_ok($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$,'dual-role Club Admin reads through active coach membership');
select lives_ok($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000021','HUSTLE',null)$$,'dual-role Club Admin writes recognition through active coach membership');
select is(public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020'),'Private confidence note','dual-role Club Admin with active coach membership may read private note');
select lives_ok($$select public.save_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','Updated private confidence note')$$,'dual-role actor writes note through coach membership');
select lives_ok($$select public.save_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020',null)$$,'null explicitly clears private note');
select is(public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020'),null,'cleared note is absent');
select is((select count(*) from public.audit_events where action like 'private_player_note.%' and team_id='72410000-0000-4000-8000-000000000012'),3::bigint,'active assistant reads private-note audit metadata for the assigned team');
reset role;

do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','team manager cannot read review');
select is(pg_temp.sqlerrm_of($$select public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020')$$),'FORBIDDEN','team manager cannot read private note');
select is((select count(*) from public.audit_events where action like 'private_player_note.%'),0::bigint,'team manager cannot read private-note audit metadata');
reset role;
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000005'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','guardian cannot read team review');
select is(pg_temp.sqlerrm_of($$select * from public.list_private_player_game_notes('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','guardian cannot list private notes');
select is((select count(*) from public.audit_events where action like 'private_player_note.%'),0::bigint,'guardian cannot read private-note audit metadata');
reset role;
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000031')$$),'FORBIDDEN','coach cannot read another team review');
select is(pg_temp.sqlerrm_of($$select public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000021')$$),'OK','team coach may read a team player note slot');
reset role;

update public.team_memberships set active=false where user_id='72410000-0000-4000-8000-000000000002' and team_id='72410000-0000-4000-8000-000000000012';
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','revoked coach loses review access immediately');
select is(pg_temp.sqlerrm_of($$select public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020')$$),'FORBIDDEN','revoked coach loses private-note access immediately');
reset role;

update public.team_memberships set active=false where user_id='72410000-0000-4000-8000-000000000006' and team_id='72410000-0000-4000-8000-000000000012';
do $$ begin perform pg_temp.assume_user('72410000-0000-4000-8000-000000000006'); end $$;
set local role authenticated;
select is(pg_temp.sqlerrm_of($$select * from public.read_post_game_review('72410000-0000-4000-8000-000000000030')$$),'FORBIDDEN','dual-role Club Admin loses M4 review access after coach membership revocation');
select is(pg_temp.sqlerrm_of($$select public.save_player_game_recognition('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020','DEFENCE',null)$$),'FORBIDDEN','dual-role Club Admin loses recognition access after coach membership revocation');
select is(pg_temp.sqlerrm_of($$select public.read_private_player_game_note('72410000-0000-4000-8000-000000000030','72410000-0000-4000-8000-000000000020')$$),'FORBIDDEN','dual-role Club Admin loses private-note access after coach membership revocation');
select is((select count(*) from public.audit_events where action like 'private_player_note.%'),0::bigint,'revoked coach loses private-note audit metadata access immediately');
reset role;

select is((select count(*) from public.audit_events where action='post_game_review.completed'),2::bigint,'initial and repeated completion each write one lifecycle audit');
select is((select count(*) from public.audit_events where action='post_game_review.reopened'),1::bigint,'reopen writes one lifecycle audit');
select is((select count(*) from public.audit_events where action='private_player_note.created'),1::bigint,'private note creation writes audit without text');
select is((select count(*) from public.audit_events where action='private_player_note.updated'),1::bigint,'private note edit writes audit without text');
select is((select count(*) from public.audit_events where action='private_player_note.cleared'),1::bigint,'private note clear writes audit without text');
select is((select count(*) from public.audit_events where action like 'private_player_note.%' and target_id='72410000-0000-4000-8000-000000000020' and team_id='72410000-0000-4000-8000-000000000012'),3::bigint,'private note audit uses opaque player identifier and exact team only');
select is((select count(*) from public.audit_events where action like 'private_player_note.%' and team_id='72410000-0000-4000-8000-000000000012'),3::bigint,'private note audit rows retain authoritative team scope');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='private_player_game_notes' and column_name ilike '%name%'),0::bigint,'private note storage has no player-name field');
select * from finish();
rollback;
