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
| Candidate commit / migration list | **Pending final commit** | Candidate to be recorded after the final local test/evidence commit. M5 migration: `20261008160000_m5_restrict_coaching_audit_visibility.sql`. No M5 schema change is part of this final delta. |
| Critical guardian, coach, manager, admin and cross-team E2E | **PASS (24/24 authenticated Playwright tests)** | Clean disposable local Supabase. Covers guardian invitation → synthetic child/team → Game Day → RSVP; active coach stats → review → next-practice focus → planner; Club Admin team/staff/guardian operations; Team Manager fixture metadata, duty assignment, announcement and fill-in; Team A coach UI and authenticated RPC denial for Team B M4 reads/writes while preserving ordinary fixture visibility; plus consumed callback replay and transient Auth network failure recovery. All data/identities are synthetic. |
| Auth recovery | **PASS for local tested journeys; external/device gates remain** | Clean disposable local Supabase authenticated Playwright: 24/24. Covers stale callback → fresh email-code recovery, a transient network failure followed by explicit retry, replay of a consumed magic-link callback without losing the authenticated session, email OTP, phone OTP, sign-out, and invitation one-time/identity binding. Account-switch cleanup has focused unit tests but no composed E2E. Expired/revoked/repeated OTP and revoked team membership with a valid session remain untested as complete E2E journeys. |
| Offline read-only failure matrix | **PASS for stale snapshot reconnect; residual P3** | Added and passed a screen-level journey: stale cached Game Day remains read-only while connectivity/context/game-day refresh runs; it is replaced only after authoritative refresh succeeds. Existing tests cover corrupt/mismatched snapshot and locator data and unauthenticated/not-found failures. No offline mutation/pending RSVP queue. If snapshot persistence succeeds but its index write fails, orphaned private data may remain on-device; it is not exposed to the incoming account. Storage cleanup robustness remains a P3 hygiene gap. |
| Accessibility | Partial | Game Day header roles and responsive browser/keyboard check added. Mobile suite passes 153 tests; focused auth-step announcement/focus and iOS offline/stale announcement tests pass. Unauthenticated responsive/keyboard Playwright: 1/1 within the 6-test suite. Manual VoiceOver/TalkBack, focus placement, touch target, dynamic-text, and device review remain pending. |
| Performance baseline | **Local HTTP baseline captured; release/device performance remains unverified** | Local optimized Next.js build served on loopback; 12 sequential synthetic GET `/` requests, all HTTP 200. `responseStart` p50 2.38 ms / p95 66.36 ms; full response p50 2.68 ms / p95 68.01 ms. This is a small same-machine HTTP smoke baseline, not a browser paint, mobile, staging, or pilot-load measurement; no product SLO or cross-machine comparison is claimed. |
| Coverage | **PASS** | Exact local rerun: web 98.18% lines, 98.21% statements, 98.95% functions, 92.81% branches; mobile 95.57% lines, 95.51% statements, 96.39% functions, 93.12% branches. Both meet 95/95/95/90. Web suite: 25 files / 127 tests; mobile suite: 18 suites / 153 tests. Full uncached unit gate passes 47 Turbo tasks. These results follow meaningful test additions; thresholds and app UI exclusions were not relaxed. |
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
| Local release gate | **PASS on current local worktree; final commit SHA pending** | Node 24.21.0 / pnpm 12.9.1. Format, lint, typecheck (25/25), and uncached Turbo unit gate (47/47 tasks) pass. Web: 25 files / 127 tests; 98.18% lines, 98.21% statements, 98.95% functions, 92.81% branches. Mobile: 18 suites / 153 tests; 95.57% lines, 95.51% statements, 96.39% functions, 93.12% branches. Web production build passes; public Expo config passes; Expo Doctor 21/21; Maestro flow validation passes; unauthenticated Playwright 6/6; clean authenticated Playwright 24/24; disposable local pgTAP 23 files / 913 assertions both before and after synthetic Auth bootstrap; club-context integration 2/2. No thresholds or exclusions changed. |
| Mobile CI timeout evidence | **PASS — deterministic test behavior established** | The affected mobile auth-gate test used Jest's default 5,000 ms timeout; remediation sets only that test's timeout to 15,000 ms. Twenty sequential focused executions passed 20/20 while the full web Vitest suite (25 files / 127 tests) ran concurrently. The CI job uses no retry policy; `.github/workflows/ci.yml` is unchanged, browser auth config has `retries: 0`, and the manual CI rerun was investigation only. Assertions, setup, and expected behavior are unchanged. The test normally completes in roughly 116 ms focused; CI runner contention showed other concurrent UI tests taking 9–24 seconds and produced the same 5-second timeout on the same test in the original run and its manual rerun. The 15-second limit allows scheduler/load variance; it does not change an assertion window or conceal an observed race. Do not increase further without new failure evidence. |
| Independent exit reviews | **Earlier 6/6 complete; final candidate reviews pending** | Earlier M5 reviews covered security/privacy/authorization, database/RLS, auth/offline/recovery, accessibility/UX, release/operations/environment, and M0–M4 regression on prior candidates. Repeat all six domains against the final committed candidate and exact release evidence before declaring exit review complete. Known residuals to confirm include local orphaned-snapshot hygiene (not exposed to another account), physical-device VoiceOver/TalkBack, and external release evidence. |
| Required GitHub Actions | **Pending final push** | Previous exact-head PR run `37720532060` passed 8/8 on `bd448cd8dded1d63adcd3b1f1c7a3ec27814afb8`. The current local delta needs to be committed, pushed to PR #3 (which remains Draft), and verified by a new 8/8 exact-head run. |

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
