# Milestone 5 — Pilot Readiness Evidence

Status: **IN PROGRESS — no pilot GO decision**

Frozen starting SHA: `342fea896d44e4224fddfe705f7ea92d0292c933`

Candidate SHA: pending

This record contains repository/process evidence only. Never add secrets, signing data, tokens, or real child information.

## Starting baseline

- M4 base and recovery refs verified at the frozen SHA; M5 branch created from `origin/main`.
- Node `v24.21.0`; pnpm `12.9.1`.
- M4 PR #2: all eight required GitHub Actions jobs passed on the recorded M4 head. This is baseline evidence, not M5 verification.
- Vercel Preview initially failed separately. The user confirmed it now succeeds after setting `NEXT_PUBLIC_APP_ENV=staging` and hosted Supabase Preview URL/publishable-key values. The prior cause was a missing/invalid app environment value; the fail-closed guard behaved correctly and no application code change was required.

## M5 release evidence

| Gate | Result | Evidence / limitation |
|---|---|---|
| Candidate commit / migration list | Pending | M5 migration: `20261008160000_m5_restrict_coaching_audit_visibility.sql`. Planning baseline, EAS preview safety, mobile/web accessibility and offline tests are also committed. |
| Critical guardian, coach, manager, admin and cross-team E2E | **PASS (23/23 authenticated Playwright tests)** | Clean disposable local Supabase. Covers guardian invitation → synthetic child/team → Game Day → RSVP; active coach stats → review → next-practice focus → planner; Club Admin team/staff/guardian operations; Team Manager fixture metadata, duty assignment, announcement and fill-in; and a Team A coach's UI and authenticated RPC denial for Team B M4 reads/writes while preserving ordinary fixture visibility. All data/identities are synthetic. |
| Auth recovery | **Partial** | Authenticated Playwright now covers stale callback rejection followed by successful fresh email-code recovery, plus email OTP, phone OTP, magic link, sign-out, and invitation one-time/identity binding. Expired/revoked/repeated OTP, callback replay, network loss, account switch/cache clearing, and revoked team membership with a valid session are not yet composed E2E journeys. |
| Offline read-only failure matrix | Partial | Focused mobile tests now cover corrupt and mismatched snapshot/locator data and unauthenticated/not-found failures; full transition/reconnect journey still pending. No offline mutation/pending RSVP queue. |
| Accessibility | Partial | Game Day header roles and responsive browser/keyboard check added. Mobile suite passes 147 tests; unauthenticated Playwright passes 6/6, including responsive Playwright 1/1. Manual VoiceOver/TalkBack, touch target and dynamic text/device review remain pending. |
| Performance baseline | Pending | No repeatable measurements found. |
| Coverage | **PASS** | Latest integrated app coverage: web 98.18% lines, 98.21% statements, 98.95% functions, 92.81% branches; mobile 95.55% lines, 95.48% statements, 96.75% functions, 92.88% branches. Both meet 95/95/95/90. Web suite: 25 files / 127 tests; mobile suite: 18 suites / 147 tests. Full `pnpm test` passes 47 Turbo tasks. These results follow meaningful test additions; thresholds and app UI exclusions were not relaxed. |
| pgTAP files/assertions | **PASS** | 23 files, 913 assertions before and after synthetic Auth bootstrap on the dedicated disposable local Supabase project; no hosted Supabase access. |
| Privacy and audit review | In progress | M4 generic coaching audit metadata is visible only to active HEAD_COACH/ASSISTANT_COACH memberships on the exact active team. Legacy rows without a provable team remain hidden through the generic table; detailed correction history remains separately restricted. Independent re-review of the team-deactivation denial fix is pending. |
| Sentry | **Partial / release gate open** | Shared capture helper now emits a constant message and bounded classification, never raw exception messages/context. Focused observability suite: 19/19 tests; 98.24% lines, 98.03% branches, 100% functions. App runtimes still do not initialize Sentry; no configured staging DSN, synthetic event receipt, environment/release tag, or source-map access was verified. Configure a dedicated staging Sentry project/DSN through the account owner's approved secret/config path, wire initialization with request-body/user/replay capture disabled, and verify a synthetic event before pilot. |
| Staging separation | **Repo config corrected; external verification pending** | EAS preview now selects the EAS `preview` environment and sets staging app mode. Staging Supabase URL and publishable key must be configured and verified in that environment. Expo config check passed; EAS cloud values/build remain unverified. |
| Backup/restore rehearsal | **PASS — disposable local only** | Added `planning/MILESTONE_5_OPERATIONS.md`. Exported synthetic application `public` data from disposable local Supabase, rebuilt schema from repository migrations on a second isolated local project, restored data with `ON_ERROR_STOP`, compared synthetic club/team counts (1/1 in source and restore), and passed all 23 pgTAP files / 912 assertions against the restored database. Hosted retention, hosted backup verification, and Storage-object recovery remain unverified; no hosted project was accessed or mutated. |
| Vercel Preview/staging | **PASS (user-confirmed)** | Preview now uses `NEXT_PUBLIC_APP_ENV=staging` with hosted Supabase Preview URL and publishable key. Root cause was missing/invalid `NEXT_PUBLIC_APP_ENV`; the existing environment guard behaved correctly. No application code change was required. No loopback values or Vercel project configuration changes. |
| TestFlight internal build | Pending | EAS/account/signing/tester state not inspected. |
| Android internal build | Pending | EAS/account/signing/tester state not inspected. |
| Pilot configuration procedure | Pending | No pilot-specific synthetic configuration/operator procedure found. |
| Dependency advisories | **Unresolved High** | `node-forge` and `braces`; current reviewed GitHub advisories list no patched versions. Existing exception remains in force. |
| Local release gate | **Partial** | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (25 packages), and uncached `pnpm exec turbo run test --force` (47/47 tasks) pass on the candidate before the final E2E-only locator corrections; web coverage (25 files / 127 tests; 98.18/98.21/98.95/92.81), mobile coverage (18 suites / 147 tests; 95.55/95.48/96.75/92.88), unauthenticated Playwright (6/6), and authenticated Playwright (23/23) pass. The candidate also passes the web production build, Expo public config, Expo Doctor (21/21), Maestro structure validation, responsive Playwright (1/1), pgTAP before/after local Auth bootstrap (23 files/913 assertions each), and club-context integration (2/2). Coverage meets target. A final full local gate on the post-correction candidate remains required before push; M5 exit also needs mobile offline transition/reconnect evidence, deeper auth recovery, performance and manual accessibility/device evidence, external setup/build verification, and six final independent reviews. |
| Independent exit reviews | **In progress** | Initial independent reads found P2 gaps in inactive-team audit visibility, mobile cached-query clearing on identity changes, mobile announcement touch targets/error announcements, and web sign-in focus transitions. Remediation and regression tests are on the current candidate; all six domains must review the final pushed SHA. |
| Required GitHub Actions on M5 head | Pending | quality, dependency-audit, supabase, web-build, expo, playwright, playwright-auth, maestro. |

## Human gates and known limits

- No hosted Supabase mutation, production operation, coordinator-initiated Vercel project/config mutation, EAS account operation, or store operation has been performed for M5. The user reports manually correcting the Preview environment.
- Staging project access, backup retention, Sentry event receipt, and mobile signing/distribution require read-only external evidence or account-owner action as applicable. Vercel Preview PASS is user-confirmed environment correction.
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
