-- Local club seed only. Do not insert auth.users or login users here.
-- Login users are created after db reset by scripts/bootstrap-local-auth.ts.

insert into public.clubs (
  id,
  name,
  slug,
  timezone,
  theme_key,
  active
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Mentone Mustangs',
  'mentone-mustangs',
  'Australia/Melbourne',
  'mustangs',
  true
);

insert into public.seasons (
  id,
  club_id,
  name,
  active
)
values (
  '88888888-8888-4888-8888-888888888888',
  '11111111-1111-4111-8111-111111111111',
  '2026 Winter',
  true
);

insert into public.teams (
  id,
  club_id,
  season_id,
  name,
  active
)
values (
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  '88888888-8888-4888-8888-888888888888',
  'U14 Boys',
  true
);
