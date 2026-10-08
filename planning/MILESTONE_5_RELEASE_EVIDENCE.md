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
| Auth recovery | **Partial** | Authenticated Playwright covers stale callback rejection followed by successful fresh email-code recovery, plus email OTP, phone OTP, magic link, sign-out, and invitation one-time/identity binding. Account-switch cleanup now has focused unit tests but no composed E2E. Expired/revoked/repeated OTP, replay of a consumed callback, network loss, and revoked team membership with a valid session remain untested as complete E2E journeys. |
| Offline read-only failure matrix | **Partial** | Focused mobile tests cover corrupt and mismatched snapshot/locator data and unauthenticated/not-found failures; full transition/reconnect journey remains pending. No offline mutation/pending RSVP queue. Account-switch cleanup is indexed; if a snapshot write succeeds but its index write fails, orphaned private data may remain on-device. The orphan is not exposed to the incoming account; storage cleanup robustness remains a P3 hygiene gap. |
| Accessibility | Partial | Game Day header roles and responsive browser/keyboard check added. Mobile suite passes 152 tests; focused auth-step announcement/focus and iOS offline/stale announcement tests pass. Manual VoiceOver/TalkBack, focus placement, touch target, dynamic-text, and device review remain pending. |
| Performance baseline | Pending | No repeatable measurements found. |
| Coverage | **PASS** | Latest integrated app coverage: web 98.18% lines, 98.21% statements, 98.95% functions, 92.81% branches; mobile 95.57% lines, 95.51% statements, 96.39% functions, 93.12% branches. Both meet 95/95/95/90. Web suite: 25 files / 127 tests; mobile suite: 18 suites / 152 tests. Full unit-test gate passes 47 Turbo tasks. These results follow meaningful test additions; thresholds and app UI exclusions were not relaxed. |
| pgTAP files/assertions | **PASS** | 23 files, 913 assertions before and after synthetic Auth bootstrap on the dedicated disposable local Supabase project; no hosted Supabase access. |
| Privacy and audit review | **No P1/P2 finding on reviewed code candidate** | M4 generic coaching audit metadata is visible only to active HEAD_COACH/ASSISTANT_COACH memberships on the exact active team. Legacy rows without a provable team remain hidden through the generic table; detailed correction history remains separately restricted. The team-deactivation denial and backfill trigger paths were independently rechecked; security, database, auth/offline, accessibility, regression, and release/operations reviews report no remaining P1/P2 findings on code/evidence candidate `b5fe712`. |
| Sentry | **Partial / release gate open** | Shared capture helper now emits a constant message and bounded classification, never raw exception messages/context. Focused observability suite: 19/19 tests; 98.24% lines, 98.03% branches, 100% functions. App runtimes still do not initialize Sentry; no configured staging DSN, synthetic event receipt, environment/release tag, or source-map access was verified. Configure a dedicated staging Sentry project/DSN through the account owner's approved secret/config path, wire initialization with request-body/user/replay capture disabled, and verify a synthetic event before pilot. |
| Staging separation | **Repo config corrected; external verification pending** | EAS preview now selects the EAS `preview` environment and sets staging app mode. Staging Supabase URL and publishable key must be configured and verified in that environment. Expo config check passed; EAS cloud values/build remain unverified. |
| Backup/restore rehearsal | **PASS — disposable local only** | Added `planning/MILESTONE_5_OPERATIONS.md`. Exported synthetic application `public` data from disposable local Supabase, rebuilt schema from repository migrations on a second isolated local project, restored data with `ON_ERROR_STOP`, compared synthetic club/team counts (1/1 in source and restore), and passed all 23 pgTAP files / 912 assertions in that restore-rehearsal run. The later complete local gate recorded 913 assertions on `3410fd9`; assertion totals are run-specific. Hosted retention, hosted backup verification, and Storage-object recovery remain unverified; no hosted project was accessed or mutated. |
| Vercel Preview/staging | **PASS (user-confirmed)** | Preview now uses `NEXT_PUBLIC_APP_ENV=staging` with hosted Supabase Preview URL and publishable key. Root cause was missing/invalid `NEXT_PUBLIC_APP_ENV`; the existing environment guard behaved correctly. No application code change was required. No loopback values or Vercel project configuration changes. |
| TestFlight internal build | Pending | EAS/account/signing/tester state not inspected. |
| Android internal build | Pending | EAS/account/signing/tester state not inspected. |
| Pilot configuration procedure | **Documented; rehearsal pending** | The first-pilot synthetic setup/operator procedure is documented in `planning/MILESTONE_5_OPERATIONS.md` under “First pilot team operator procedure.” Pilot configuration and an operator rehearsal have not yet been completed or externally validated. |
| Dependency advisories | **Unresolved High** | `node-forge` and `braces`; current reviewed GitHub advisories list no patched versions. Existing exception remains in force. |
| Local release gate | **PASS (latest local evidence)** | On code candidate `0b41d7ee7a70c812f34a58389ed0b22c854fb1ed`: Node 24.21.0 / pnpm 12.9.1; format, lint, typecheck (25 packages), and uncached tests (47/47 Turbo tasks) pass. Coverage: web 25 files / 127 tests, 98.18% lines / 98.21% statements / 98.95% functions / 92.81% branches; mobile 18 suites / 152 tests, 95.57% / 95.51% / 96.39% / 93.12%. Web build, public Expo config, Expo Doctor (21/21), Maestro flow validation, unauthenticated Playwright (6/6), authenticated Playwright (23/23), pgTAP (23 files / 913 assertions before and after synthetic Auth bootstrap on prior tested candidate `3410fd9`), and club-context integration (2/2) passed on earlier integrated candidate code; the later changes were mobile-only and were rechecked with the current full unit gate. No coverage thresholds or exclusions were relaxed. M5 exit remains open for mobile offline transition/reconnect, performance and manual accessibility/device evidence, external setup/build verification, and exact-head GitHub Actions. |
| Independent exit reviews | **6/6 complete** | Security/privacy/authorization, database/RLS, auth/offline/recovery, accessibility/UX, release/operations/environment, and M0–M4 regression reviews independently checked code/evidence candidate `b5fe7126941b54f8fbe81401cbb8edc45c24e746`. Later PR updates are documentation-only. Final SHA confirmations on `ff8089f6a53ad402d0ada4d2ed77126aa4327e3e` found no changed contract or evidence claims. No remaining P1/P2 findings. The earlier audit-backfill concern was withdrawn after trigger verification. A P3 local storage-hygiene limitation remains: an orphaned offline snapshot may remain if its index write failed, without being available to another account. Physical-device VoiceOver/TalkBack evidence is still outstanding. |
| Required GitHub Actions | **PASS — 8/8 on exact PR head** | CI run `37719041130` passed quality, dependency-audit, supabase, web-build, expo, playwright, playwright-auth, and maestro on exact PR head `96b1e5ae6ec65599318216e1a536f677b56c6096`. This commit records the CI result; its documentation-only follow-up receives its own exact-head Actions run. |

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
