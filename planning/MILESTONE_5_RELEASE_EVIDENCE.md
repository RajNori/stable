# Milestone 5 — Pilot Readiness Evidence

Status: **IN PROGRESS — no pilot GO decision**

Frozen starting SHA: `342fea896d44e4224fddfe705f7ea92d0292c933`

Candidate SHA: pending

This record contains repository/process evidence only. Never add secrets, signing data, tokens, or real child information.

## Starting baseline

- M4 base and recovery refs verified at the frozen SHA; M5 branch created from `origin/main`.
- Node `v24.21.0`; pnpm `12.9.1`.
- M4 PR #2: all eight required GitHub Actions jobs passed on the recorded M4 head. This is baseline evidence, not M5 verification.
- M4 Vercel Preview: **FAILED separately**. The current Vercel CLI context cannot inspect the deployment; root/settings/log cause remain unverified.

## M5 release evidence

| Gate | Result | Evidence / limitation |
|---|---|---|
| Candidate commit / migration list | Pending | M5 migration: `20261008160000_m5_restrict_coaching_audit_visibility.sql`. Planning baseline, EAS preview safety, mobile/web accessibility and offline tests are also committed. |
| Critical guardian, coach, manager, admin and cross-team E2E | **Partial** | Authenticated Playwright suite passes 18/18 against clean disposable local Supabase, covering club/team admin, guardian invitation acceptance contract, fixture/duty/fill-in, announcement, roster/player access, and outsider denial. No composed guardian child/team → Game Day → RSVP journey or coach stats → review → next-practice focus → planner journey exists yet. Manager-only workflow and explicit Team A → Team B denial E2E also remain open. |
| Auth recovery | **Partial** | Authenticated Playwright proves email OTP, phone OTP, magic-link callback, sign-out, and invitation one-time/identity binding. Expired/revoked/stale/repeated OTP, callback failure/replay, network loss, account switch/cache clearing, and revoked team membership with a valid session are not yet composed E2E journeys. |
| Offline read-only failure matrix | Partial | Focused mobile tests now cover corrupt and mismatched snapshot/locator data and unauthenticated/not-found failures; full transition/reconnect journey still pending. No offline mutation/pending RSVP queue. |
| Accessibility | Partial | Game Day header roles and responsive browser/keyboard check added. Full mobile suite passes 95 tests; responsive Playwright passes 1 test. Manual VoiceOver/TalkBack, touch target and dynamic text/device review remain pending. |
| Performance baseline | Pending | No repeatable measurements found. |
| Coverage | **FAIL — below M5 target** | Full `pnpm test` passes 47 Turbo tasks, including shared-package coverage gates at lines/statements/functions ≥95% and branches ≥90%. A separate coverage run reports web: lines 84.72%, statements 84.13%, functions 80.62%, branches 76.93%; mobile: lines 84.64%, statements 84.71%, functions 81.77%, branches 83.53%. These fail the M5 95/95/95/90 target. Coverage gaps include error/empty/alternate UI states and platform runtime paths. Add meaningful behavioral tests or fix uncovered dead paths; do not lower thresholds or blanket-exclude app UI. Jest completed 95 tests but the regular run reported a worker force-exit warning; `--detectOpenHandles` also remained alive after reporting all tests, so lifecycle stability needs follow-up. |
| pgTAP files/assertions | **PASS** | 23 files, 912 assertions, isolated local Supabase project with separate ID/ports; no hosted Supabase access. |
| Privacy and audit review | In progress | M4 generic coaching audit metadata is now visible only to active HEAD_COACH/ASSISTANT_COACH for its exact team. Legacy rows without a provable team remain hidden through the generic table; detailed correction history remains separately restricted. Independent exit review pending. |
| Sentry | **Partial / release gate open** | Shared capture helper now emits a constant message and bounded classification, never raw exception messages/context. Focused observability suite: 19/19 tests; 98.24% lines, 98.03% branches, 100% functions. App runtimes still do not initialize Sentry; no configured staging DSN, synthetic event receipt, environment/release tag, or source-map access was verified. Configure a dedicated staging Sentry project/DSN through the account owner's approved secret/config path, wire initialization with request-body/user/replay capture disabled, and verify a synthetic event before pilot. |
| Staging separation | **Repo config corrected; external verification pending** | EAS preview now selects the EAS `preview` environment and sets staging app mode. Staging Supabase URL and publishable key must be configured and verified in that environment. Expo config check passed; EAS cloud values/build remain unverified. |
| Backup/restore rehearsal | **PASS — disposable local only** | Added `planning/MILESTONE_5_OPERATIONS.md`. Exported synthetic application `public` data from disposable local Supabase, rebuilt schema from repository migrations on a second isolated local project, restored data with `ON_ERROR_STOP`, compared synthetic club/team counts (1/1 in source and restore), and passed all 23 pgTAP files / 912 assertions against the restored database. Hosted retention, hosted backup verification, and Storage-object recovery remain unverified; no hosted project was accessed or mutated. |
| Vercel Preview/staging | **Failed / unclassified** | M4 Preview failed; current CLI account context cannot inspect deployment. |
| TestFlight internal build | Pending | EAS/account/signing/tester state not inspected. |
| Android internal build | Pending | EAS/account/signing/tester state not inspected. |
| Pilot configuration procedure | Pending | No pilot-specific synthetic configuration/operator procedure found. |
| Dependency advisories | **Unresolved High** | `node-forge` and `braces`; current reviewed GitHub advisories list no patched versions. Existing exception remains in force. |
| Local release gate | **Partial** | Passed `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (25 packages), web production build, Expo public config, Expo Doctor (21/21), workspace tests (47 Turbo tasks), authenticated Playwright (18/18), responsive Playwright (1/1), full mobile tests (95/95), pgTAP before/after local Auth bootstrap (23 files/912 assertions each), and club-context integration (2/2). Full M5 gate remains open for critical missing journeys, app UI coverage, performance/accessibility/manual device evidence, Maestro validation, and external setup/build verification. |
| Independent exit reviews | Pending | Six required read-only reviews after implementation and local gates. |
| Required GitHub Actions on M5 head | Pending | quality, dependency-audit, supabase, web-build, expo, playwright, playwright-auth, maestro. |

## Human gates and known limits

- No hosted Supabase, production, Vercel project/config, EAS account, or store operation has been performed for M5.
- Staging project access/configuration, backup retention, Sentry event receipt, Vercel deployment details, and mobile signing/distribution require read-only external evidence or account-owner action as applicable.
- No supported patches were listed for the accepted High dependency advisories at audit time. Production remains NO-GO while the exception records `productionStatus: BLOCKED`.
- Pilot GO / NO-GO: **not decided**.
- Production GO / NO-GO: **NO-GO** while the documented exception remains blocked.

## Final results

Populate this section only after all gates are complete:

- Test summary, coverage summary, pgTAP assertion count:
- E2E, auth recovery, offline, accessibility, performance:
- Security, privacy, audit reviews:
- Sentry, Vercel, backup/restore, TestFlight, Android:
- Dependency advisory status and known issues:
- Human gates remaining:
- Pilot GO / NO-GO:
- Production GO / NO-GO:
- Exact candidate SHA and repository state:
