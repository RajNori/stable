# Environments

## Environments
1. local
2. staging/preview
3. production

## Supabase
Use separate staging and production projects.
Local uses Supabase CLI.

Never point a PR preview/mobile dev build at production by default.

## Vercel
- PR -> preview deployment.
- main release candidate -> staging as configured.
- production -> explicit approved promotion/deployment.

## Expo/EAS
Profiles:
- development
- preview
- production

The `preview` build profile selects the EAS `preview` environment and sets
`EXPO_PUBLIC_APP_ENV=staging`. Configure
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in that
EAS environment using the staging project only. Do not put those values in
`eas.json`; the URL and publishable key must never point to production for an
internal pilot build. Validate the resulting app configuration before
distribution.

iOS and Android are MVP targets from the first pilot.

## Environment validation
All required variables validated at boot/build.

Classify:
- public client-safe;
- private server;
- CI-only;
- provider secret.

Never put secrets in `EXPO_PUBLIC_*`.

### Web application origin and Auth callbacks

- Local web defaults to the exact origin `http://127.0.0.1:3000`.
- Staging and production require `NEXT_PUBLIC_SITE_URL` to be the exact
  canonical HTTPS origin for that deployment, with no path, query, fragment,
  credentials, port, or trailing slash. It is a public URL, not a secret.
- Web email callbacks are constructed as
  `${NEXT_PUBLIC_SITE_URL}/auth/callback`; the app never trusts the incoming
  Host header to choose a callback or redirect origin.
- Configure the matching Supabase Auth Site URL and exact redirect allowlist
  entry separately in each Supabase project. Staging must contain only its
  approved web callback and `stable://auth/callback` where mobile email links
  are enabled. Do not use wildcard or production callback entries in staging.
- A successful local configuration check proves neither hosted project
  identity nor Dashboard callback configuration. Record those as hosted
  evidence only after read-only inspection of the positively identified
  staging project.

## Worktrees
Do not run multiple default Supabase local stacks concurrently unless the worktree is explicitly configured for isolated ports/stacks.
The Supabase agent coordinates database-local execution during parallel work.
