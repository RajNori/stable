# Hosted staging acceptance (`staging-e2e`)

Runs the pilot acceptance journeys against the **real Vercel Preview + approved staging Supabase** (`rporaeagbsfmgbmhyett`). Local CI (`ci.yml`) stays the fast gate and keeps refusing hosted credentials. This workflow is the only exception.

## What it does

1. Idempotent seed plus role access smoke: `scripts/staging/seed-pilot.ts --confirm-staging --verify-access`. It creates synthetic users, teams and events only, never overwrites operator edits, and never touches production.
2. Playwright `apps/web/e2e-hosted/pilot-acceptance.spec.ts`:
   - **Admin:** add player, register to team, guardian invitation, staff invitation (then unregister and deactivate the player).
   - **Manager + Guardian:** fixture, guardian RSVP (own child only), availability, duty allocation, acknowledgement-required update, guardian acknowledges, manager sees 1 (then archive the update).
   - **Coach:** score, player stat, completed review, practice and plan.
   - **Security:** Manager and Club-Admin-only see no coaching data; the other-team coach and a single-team guardian are refused; the guardian's own session gets `FORBIDDEN` from the coaching RPCs.

All writes use a run-unique `[E2E] <timestamp>` label. Future events are dated 60+ days out, clear of the seeded pilot week.

## One-time setup (owner)

GitHub → Settings → Environments → **New environment** `staging`:

1. **Required reviewers:** add yourself. Every run then waits for your approval.
2. **Environment secrets:**
   - `STAGING_SECRET_KEY`: a **staging-only** Supabase secret key (Supabase → staging project → Settings → API Keys). Create a dedicated one named `github-staging-e2e` so it can be revoked on its own. If the seed rejects an `sb_secret_` key, use the legacy `service_role` key.
   - `STAGING_PUBLISHABLE_KEY`: the staging publishable key, the same value as the Vercel Preview's `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - `VERCEL_AUTOMATION_BYPASS_SECRET`: Vercel → Project `web` → Settings → Deployment Protection → Protection Bypass for Automation → Add. Previews use SSO protection.

The Supabase URL, the default Preview origin (the milestone branch alias) and the production origin it refuses are pinned in the workflow. Repository variables `STAGING_WEB_URL` and `PRODUCTION_WEB_URL` can override them.

## Run

Actions → **staging-e2e** → Run workflow from the branch whose Preview you are testing. Optionally pass `web_url` for a specific deployment URL. Approve the environment gate. The HTML report is uploaded as `hosted-acceptance-report`.

## Guarantees and limits

- The secret key exists only in the runner. It mints one-time magic-link sessions through Auth Admin (no email is sent) and is never sent to the browser or the app.
- Playwright traces are off because they would capture session cookies.
- Target guards fail closed: HTTPS only, no loopback, not the production origin, and exactly the approved staging Supabase URL.
- The test only covers the code that is **deployed** to the target Preview. Run it after the Preview for that commit is Ready.
- It does not cover mobile, SMS OTP or push. Use `planning/M5B_GUARDIAN_DEVICE_SCRIPT.md` for those.
