# CI/CD

## Pull request gates
- install from lockfile;
- formatting check;
- lint;
- TypeScript;
- unit tests;
- coverage;
- Supabase DB/pgTAP tests;
- RLS/security tests;
- integration tests;
- web build;
- Expo config/doctor validation;
- selected E2E based on changed paths.

## Main branch
Protected.
No direct human/agent pushes once collaboration begins except emergency policy defined later.

## Preview
Vercel preview must use non-production backend.

EAS preview builds use preview/staging backend.

## Database deployment
Migrations are source-controlled.
No Dashboard-only production schema edits.
Migration order is validated from clean local database.

## Production
Human approval required.
Release checklist in `RELEASE.md`.

## Rollback
Application rollback and database rollback are not identical.
Prefer forward-fix for migrations unless a tested safe rollback exists.
Never promise rollback for destructive migrations without proof.
