# Milestone 0 freeze

Integrator serial phase. Breaking changes to this list return to the Integrator.
Do not edit single-writer files from a workstream branch.

## Single-writer files

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `eslint.config.js`
- `prettier.config.js`
- `vitest.shared.ts`
- `.github/workflows/ci.yml` once it exists
- `packages/contracts/**`
- `packages/database-types/**` except generator output owned by the Supabase agent
- `packages/design-tokens/**`
- `supabase/migrations/**`
- `scripts/bootstrap-local-auth.ts` once it exists

`packages/contracts` must not depend on `packages/database-types`.

## Pins

- Node `24.21.0`
- pnpm `12.9.1`
- TypeScript `6.0.3` (TypeScript 7 is current on npm, and `typescript-eslint@8.71.0` only accepts TypeScript below 6.1)
- Expo SDK 57. Lockfile resolved `expo@57.0.26` at bootstrap (the plan named `57.0.23`; this is a later SDK 57 patch). React `19.2.3`, React Native `0.86.3`
- Next.js `16.3.8`
- Supabase CLI `2.118.0` until macOS `start` / `reset` / `test` is proven. Do not move to `2.119.0` without that proof. Only the Integrator changes the pin.

## Frozen contract

Package: `@stable/contracts`.

- `CurrentClubContext`: `userId`, `displayName`, `club | null`, `activeTeam: null`, `capabilities`, `managedPlayerIds`
- `ApplicationError` codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `STALE_WRITE`, `UPSTREAM_UNAVAILABLE`, `RATE_LIMITED`, `INTERNAL`
- `Principal`: `userId`, optional `displayName`. No `role`. No provider tokens.
- `EvaluateCapability` input: `memberships`, `capability` string, `clubId`. Returns `allow | deny`.
- Known capability in Milestone 0: `club.read`
- Club role in Milestone 0: `CLUB_ADMIN`
- `GetCurrentClubContext` and `ClubContextReader` types
- Env names in `ENV`
- `SENSITIVE_METADATA_FIELDS`

## Milestone 0 tables

`clubs`: `id`, `name`, `slug`, `timezone`, `theme_key`, `active`, `created_at`, `updated_at`

`profiles`: `user_id`, `display_name`, `first_name`, `last_name`, `phone_e164`, `email`, `locale`, `created_at`, `updated_at`

`club_memberships`: `id`, `club_id`, `user_id`, `role`, `active`, `created_at`, `updated_at`

Seed club only in `supabase/seed.sql`:

- id `11111111-1111-4111-8111-111111111111`
- name `Mentone Mustangs`
- slug `mentone-mustangs`
- timezone `Australia/Melbourne`
- theme_key `mustangs`

Login users, created by the Auth Admin bootstrap script, not SQL:

- `member@local.stable.test` active `CLUB_ADMIN`
- `outsider@local.stable.test` no membership

## Workstream paths

- `m0/platform`: `.github/workflows/**`, `eas.json`, Vercel config, `packages/config/**`, `packages/observability/**`
- `m0/supabase`: `supabase/**`, `packages/database-types/**` via the generator, `scripts/bootstrap-local-auth.ts`
- `m0/domain`: `packages/features/current-club-context/**`
- `m0/auth`: `packages/auth/**`, `packages/permissions/**`
- `m0/mobile`: `apps/mobile/**`
- `m0/web`: `apps/web/**`

One local Supabase stack. Do not run a second `supabase start` from another worktree.
