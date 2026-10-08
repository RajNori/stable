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

## Worktrees
Do not run multiple default Supabase local stacks concurrently unless the worktree is explicitly configured for isolated ports/stacks.
The Supabase agent coordinates database-local execution during parallel work.
