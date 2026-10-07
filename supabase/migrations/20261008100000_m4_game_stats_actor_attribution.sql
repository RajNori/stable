-- Retain the original recorder and most recent editor on Stable-owned stats.
alter table public.game_player_stats
  add column recorded_by uuid not null references auth.users (id),
  add column updated_by uuid not null references auth.users (id);

create or replace function public.set_game_player_stats_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if tg_op = 'INSERT' then
    new.recorded_by := actor;
  end if;
  new.updated_by := actor;
  return new;
end;
$$;

create trigger game_player_stats_set_actor
  before insert or update on public.game_player_stats
  for each row execute function public.set_game_player_stats_actor();

revoke all on function public.set_game_player_stats_actor() from public, anon, authenticated;
