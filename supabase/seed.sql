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
