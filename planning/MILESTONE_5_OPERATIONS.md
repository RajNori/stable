# Milestone 5 — Pilot Operations Runbook

This runbook is for a controlled pilot. Store credentials only in the approved
secret manager or provider environment; never in git, tickets, terminal logs,
or this document. Use synthetic data for rehearsal. Production release remains
blocked while the accepted dependency exception reports `productionStatus:
BLOCKED`.

## Backup and restore

### Local rehearsal

Use a disposable local Supabase project with a unique project ID and ports. Do
not run `db reset`, `db drop`, or restore against the developer's normal local
project or any hosted project.

1. Start the disposable source project and run the repository migrations and
   synthetic seed. Never put a hosted connection string in shell history.
2. Export only application data into a private temporary directory (not the
   repo); the schema is reconstructed from the versioned migrations:

   ```sh
   supabase db dump --local --data-only --use-copy --schema public \
     --file /private/tmp/stable-public-data.sql
   ```

3. Create a second disposable local Supabase project with a unique project ID
   and ports. Disable seed application on the restore target, apply repository
   migrations, then restore the public data dump using `psql` with
   `ON_ERROR_STOP=1`. Do not restore Supabase-managed schemas or internal
   tables from a generic dump.
4. Verify the migration ledger, key table counts, and full pgTAP/RLS suite
   against the restored database.
5. Record only the project identity, commands, pass/fail, and counts. Delete the
   dumps and disposable database when evidence is captured.

The CLI's generic schema dump references Supabase-managed schemas and is not a
standalone schema restore. Reconstructing from migrations avoids replaying
internal schemas. This local drill does not prove hosted backup retention or
include a hosted Storage-object recovery test. Those remain staging-owner
verification items.

### Hosted staging procedure (operator gate)

Before any hosted restore, the staging owner must confirm the exact project
reference, backup timestamp, restore point, data classification, and expected
impact. First verify a non-destructive export and retain it only in the
approved encrypted backup location. Restore into a separate disposable staging
project where possible. If restoring in place is required, stop and obtain
explicit human approval for the exact command and impact. Never point these
commands at production as part of the pilot drill.

After a restore, verify migration state, Auth login/recovery, storage privacy,
RLS allow/deny matrices, and critical journeys using synthetic accounts before
reopening staging to testers. Record owner, timestamp, backup identifier,
validation results, and rollback path without recording secrets or personal
data.

## Staging and observability setup gates

- EAS `preview` must use the remote EAS `preview` environment and the staging
  app mode. The account owner must set the staging Supabase URL and public
  publishable key there, verify their project is non-production, and complete
  an internal build. Do not paste values into this runbook.
- Web preview must use a staging Supabase project and preview-only public
  variables. Keep service-role keys server-only. Verify preview redirects,
  Auth callbacks, storage policies, and project identity before inviting pilot
  users.
- Configure a dedicated Sentry project/environment for staging. The app must
  send only normalized exception data; do not enable request-body capture,
  user identity, breadcrumbs containing navigation/form data, or replay. Verify
  a synthetic error event and its environment/release tags in Sentry before
  considering delivery verified. No Sentry account/DSN was configured by this
  repository change, so delivery remains an external gate.
- PostHog remains unwired. If enabled later, use an approved project and
  allowlisted event metadata only. Never send child names, contact details,
  private notes, attendance reasons, raw URLs, or free text.
- Configure push credentials only through EAS/provider secret storage after
  staging app IDs, deep links, and callback URLs are verified.

## Production configuration checklist

Complete and sign off outside git before any production release.

### Supabase

- [ ] Production project is separate from development and staging; record
  project references in the release system, not secrets here.
- [ ] All reviewed migrations are applied in order; migration status is clean.
- [ ] RLS is enabled and the capability/RLS allow and deny matrix passes.
- [ ] Auth site URL and redirect allowlist contain only approved production
  domains and callbacks.
- [ ] SMTP sender/domain, delivery, and rate limits are verified.
- [ ] SMS provider, consent, and rate limits are verified if enabled.
- [ ] Apple and Google OAuth identifiers, redirect URIs, and owner access are
  verified if enabled.
- [ ] Service-role keys exist only in server/CI secret stores and are absent
  from mobile bundles, browser bundles, logs, and PR artifacts.
- [ ] Storage buckets are private by default; object read/write policies pass
  cross-team and anonymous denial checks.
- [ ] Backup retention, point-in-time recovery availability, export custody,
  restore owner, and recovery-time expectations are documented and tested.

### Vercel

- [ ] Project and root directory point to `apps/web` using repository-supported
  build configuration.
- [ ] Preview, staging, and production environments map to separate Supabase
  projects and distinct Auth redirect allowlists.
- [ ] Public variables are limited to app mode, Supabase URL/publishable key,
  and approved public observability values; server secrets remain server-only.
- [ ] Production deployment requires the protected main branch and all required
  checks; preview failure does not weaken this gate.
- [ ] Review CSP/security headers against actual auth, storage, and asset
  origins before enabling a restrictive policy.

### Mobile / EAS

- [ ] iOS bundle ID and Android package are the approved production identifiers.
- [ ] Development, preview, and production profiles use their matching app
  modes and Supabase projects.
- [ ] Version and platform build numbers are unique and recorded against the
  source commit.
- [ ] iOS/Android signing credentials are owned and recoverable by the account
  owner; no signing material is committed.
- [ ] Push credentials, universal/app links, and auth callbacks are verified
  for each environment.
- [ ] TestFlight and Android internal distribution are verified before pilot
  use. Public store submission is a separate approval.

### Observability, analytics, and GitHub

- [ ] Sentry project/environment, scrub behavior, source-map access, and release
  identifiers are verified with synthetic errors; event payloads contain no
  child/guardian data or request bodies.
- [ ] PostHog is disabled unless privacy review approves the event allowlist and
  project configuration; child PII and free text are prohibited.
- [ ] All eight required GitHub checks are required on the protected main
  branch; branch must be up to date before merge.
- [ ] PR CI uses no deploy secrets and cannot deploy, publish, or mutate hosted
  Supabase.

## First pilot team operator procedure

1. Confirm authorization and create/select the pilot club and season through
   approved admin workflows.
2. Configure the competition and venues, then create each team. Keep team
   identity in data/configuration; never add pilot-specific IDs to application
   logic.
3. Add staff with least-privilege active memberships. Verify head coach,
   assistant coach, manager, and club-admin boundaries using synthetic
   accounts before guardian invitations.
4. Create guardian invitations using the authorized workflow and verify the
   callback domain and delivery channel without recording contact details in
   source control or release evidence.
5. Create players and registrations through the authorized app flow. Use
   synthetic records for rehearsals; enter real child data only through the
   approved operational process after privacy/consent checks.
6. Configure recurring training and initial fixtures, then validate club,
   season, venue, and team scope in each account.
7. Verify notification readiness, opt-out behavior, delivery configuration,
   and no cross-team disclosure before sending pilot communications.
8. Record operator, date, checks, and unresolved issues in the release system
   without names, contact details, tokens, or credentials.
