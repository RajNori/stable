-- Slice 1.5 invitations.
-- Classification: additive. No backfill and no destructive change.
-- An invitation is not authorization. Acceptance writes a guardian
-- relationship or a team staff membership. Raw tokens are not stored.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  team_id uuid,
  player_id uuid,
  invite_type text not null,
  intended_email text,
  intended_phone text,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_type_check check (
    invite_type in (
      'GUARDIAN',
      'HEAD_COACH',
      'ASSISTANT_COACH',
      'TEAM_MANAGER'
    )
  ),
  constraint invitations_identity_check check (
    (
      intended_email is not null
      and intended_phone is null
    )
    or (
      intended_email is null
      and intended_phone is not null
    )
  ),
  constraint invitations_email_check check (
    intended_email is null
    or intended_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint invitations_phone_check check (
    intended_phone is null
    or intended_phone ~ '^\+?[0-9]{8,20}$'
  ),
  constraint invitations_shape_check check (
    (
      invite_type = 'GUARDIAN'
      and player_id is not null
      and team_id is null
    )
    or (
      invite_type in ('HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER')
      and team_id is not null
      and player_id is null
    )
  ),
  constraint invitations_team_same_club
    foreign key (team_id, club_id)
    references public.teams (id, club_id),
  constraint invitations_player_same_club
    foreign key (player_id, club_id)
    references public.players (id, club_id),
  constraint invitations_token_hash_key unique (token_hash)
);

create index invitations_club_id_idx on public.invitations (club_id);
create index invitations_team_id_idx on public.invitations (team_id);
create index invitations_player_id_idx on public.invitations (player_id);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row
  execute function public.set_updated_at();

alter table public.invitations enable row level security;
alter table public.invitations force row level security;

revoke all on table public.invitations from public, anon, authenticated;
grant select, insert, update, delete on table public.invitations to service_role;

alter table public.audit_events drop constraint audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'season.created',
      'season.updated',
      'competition.created',
      'competition.updated',
      'team.created',
      'team.updated',
      'venue.created',
      'venue.updated',
      'player.created',
      'player.imported',
      'player.updated',
      'player.deactivated',
      'player.reactivated',
      'guardian.linked',
      'guardian.unlinked',
      'team_staff.assigned',
      'team_staff.revoked',
      'team_staff.reactivated',
      'player_team.registered',
      'player_team.unregistered',
      'invitation.created',
      'invitation.revoked',
      'invitation.accepted'
    )
  );

create or replace function public.create_invitation(
  p_club_id uuid,
  p_invite_type text,
  p_team_id uuid,
  p_player_id uuid,
  p_intended_email text,
  p_intended_phone text
)
returns table (
  id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  email_value text := nullif(lower(btrim(coalesce(p_intended_email, ''))), '');
  phone_value text := nullif(
    regexp_replace(coalesce(p_intended_phone, ''), '[[:space:]]', '', 'g'),
    ''
  );
  raw_token text;
  created public.invitations;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = p_club_id
      and membership.user_id = actor
      and membership.role = 'CLUB_ADMIN'
      and membership.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_invite_type not in (
    'GUARDIAN',
    'HEAD_COACH',
    'ASSISTANT_COACH',
    'TEAM_MANAGER'
  )
  or (email_value is null) = (phone_value is null)
  or (
    p_invite_type = 'GUARDIAN'
    and (p_player_id is null or p_team_id is not null)
  )
  or (
    p_invite_type <> 'GUARDIAN'
    and (p_team_id is null or p_player_id is not null)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  if p_invite_type = 'GUARDIAN' then
    if not exists (
      select 1
      from public.players as player
      where player.id = p_player_id
        and player.club_id = p_club_id
        and player.active
    ) then
      if exists (
        select 1
        from public.players as player
        where player.id = p_player_id
          and player.club_id = p_club_id
      ) then
        raise exception 'VALIDATION_FAILED' using errcode = '23514';
      end if;
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  elsif not exists (
    select 1
    from public.teams as team
    where team.id = p_team_id
      and team.club_id = p_club_id
      and team.active
  ) then
    if exists (
      select 1
      from public.teams as team
      where team.id = p_team_id
        and team.club_id = p_club_id
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitations (
    club_id,
    team_id,
    player_id,
    invite_type,
    intended_email,
    intended_phone,
    token_hash,
    expires_at,
    created_by
  )
  values (
    p_club_id,
    p_team_id,
    p_player_id,
    p_invite_type,
    email_value,
    phone_value,
    encode(
      extensions.digest(convert_to(raw_token, 'utf8'), 'sha256'),
      'hex'
    ),
    pg_catalog.now() + interval '7 days',
    actor
  )
  returning * into created;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (created.club_id, actor, 'invitation.created', created.id);

  return query
  select created.id, raw_token, created.expires_at;
end;
$$;

create or replace function public.list_club_invitations(p_club_id uuid)
returns table (
  id uuid,
  club_id uuid,
  team_id uuid,
  player_id uuid,
  invite_type text,
  intended_email text,
  intended_phone text,
  expires_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = p_club_id
      and membership.user_id = actor
      and membership.role = 'CLUB_ADMIN'
      and membership.active
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    invitation.id,
    invitation.club_id,
    invitation.team_id,
    invitation.player_id,
    invitation.invite_type,
    invitation.intended_email,
    invitation.intended_phone,
    invitation.expires_at,
    invitation.consumed_at,
    invitation.revoked_at,
    invitation.created_at,
    case
      when invitation.consumed_at is not null then 'consumed'
      when invitation.revoked_at is not null then 'revoked'
      when invitation.expires_at <= pg_catalog.now() then 'expired'
      else 'pending'
    end
  from public.invitations as invitation
  where invitation.club_id = p_club_id
  order by invitation.created_at, invitation.id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.invitations;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select row.*
  into invitation
  from public.invitations as row
  where row.id = p_invitation_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = invitation.club_id
      and membership.user_id = actor
      and membership.role = 'CLUB_ADMIN'
      and membership.active
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if invitation.consumed_at is not null
    or invitation.revoked_at is not null
    or invitation.expires_at <= pg_catalog.now() then
    raise exception 'VALIDATION_FAILED' using errcode = '23514';
  end if;

  update public.invitations
  set revoked_at = pg_catalog.now()
  where id = invitation.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (invitation.club_id, actor, 'invitation.revoked', invitation.id);

  return invitation.id;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns table (
  invitation_id uuid,
  invite_type text,
  club_id uuid,
  team_id uuid,
  player_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := auth.uid();
  invitation public.invitations;
  actor_email text;
  actor_phone text;
  email_confirmed timestamptz;
  phone_confirmed timestamptz;
  normalized_token text := lower(btrim(coalesce(p_token, '')));
  relation public.guardian_relationships;
  membership public.team_memberships;
  inserted boolean := false;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if normalized_token !~ '^[0-9a-f]{64}$' then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select row.*
  into invitation
  from public.invitations as row
  where row.token_hash = encode(
    extensions.digest(convert_to(normalized_token, 'utf8'), 'sha256'),
    'hex'
  )
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if invitation.consumed_at is not null then
    raise exception 'ALREADY_CONSUMED' using errcode = 'P0001';
  end if;

  if invitation.revoked_at is not null then
    raise exception 'REVOKED' using errcode = 'P0001';
  end if;

  if invitation.expires_at <= pg_catalog.now() then
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;

  select
    account.email,
    account.phone,
    account.email_confirmed_at,
    account.phone_confirmed_at
  into actor_email, actor_phone, email_confirmed, phone_confirmed
  from auth.users as account
  where account.id = actor;

  if invitation.intended_email is not null
    and (
      email_confirmed is null
      or lower(actor_email) is distinct from invitation.intended_email
    ) then
    raise exception 'IDENTITY_MISMATCH' using errcode = 'P0001';
  end if;

  if invitation.intended_phone is not null
    and (
      phone_confirmed is null
      or regexp_replace(coalesce(actor_phone, ''), '[[:space:]]', '', 'g')
        is distinct from invitation.intended_phone
    ) then
    raise exception 'IDENTITY_MISMATCH' using errcode = 'P0001';
  end if;

  if invitation.invite_type = 'GUARDIAN' then
    if not exists (
      select 1
      from public.players as player
      where player.id = invitation.player_id
        and player.club_id = invitation.club_id
        and player.active
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;

    insert into public.guardian_relationships (
      club_id,
      player_id,
      user_id,
      active
    )
    values (
      invitation.club_id,
      invitation.player_id,
      actor,
      true
    )
    on conflict (player_id, user_id) do nothing
    returning * into relation;

    inserted := found;

    if not inserted then
      select relationship.*
      into relation
      from public.guardian_relationships as relationship
      where relationship.player_id = invitation.player_id
        and relationship.user_id = actor
      for update;

      if not relation.active then
        update public.guardian_relationships
        set active = true
        where id = relation.id
        returning * into relation;
        inserted := true;
      end if;
    end if;

    if inserted then
      insert into public.audit_events (club_id, actor_user_id, action, target_id)
      values (invitation.club_id, actor, 'guardian.linked', relation.id);
    end if;
  else
    if not exists (
      select 1
      from public.teams as team
      where team.id = invitation.team_id
        and team.club_id = invitation.club_id
        and team.active
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = '23514';
    end if;

    insert into public.team_memberships (
      club_id,
      team_id,
      user_id,
      role,
      active
    )
    values (
      invitation.club_id,
      invitation.team_id,
      actor,
      invitation.invite_type,
      true
    )
    on conflict (team_id, user_id, role) do nothing
    returning * into membership;

    inserted := found;

    if not inserted then
      select row.*
      into membership
      from public.team_memberships as row
      where row.team_id = invitation.team_id
        and row.user_id = actor
        and row.role = invitation.invite_type
      for update;

      if not membership.active then
        update public.team_memberships
        set active = true
        where id = membership.id
        returning * into membership;
        inserted := true;
      end if;
    end if;

    if inserted then
      insert into public.audit_events (club_id, actor_user_id, action, target_id)
      values (invitation.club_id, actor, 'team_staff.assigned', membership.id);
    end if;
  end if;

  update public.invitations
  set consumed_at = pg_catalog.now()
  where id = invitation.id;

  insert into public.audit_events (club_id, actor_user_id, action, target_id)
  values (invitation.club_id, actor, 'invitation.accepted', invitation.id);

  return query
  select
    invitation.id,
    invitation.invite_type,
    invitation.club_id,
    invitation.team_id,
    invitation.player_id;
end;
$$;

revoke all on function public.create_invitation(uuid, text, uuid, uuid, text, text)
  from public, anon;
revoke all on function public.list_club_invitations(uuid) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;

grant execute on function public.create_invitation(uuid, text, uuid, uuid, text, text)
  to authenticated;
grant execute on function public.list_club_invitations(uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
