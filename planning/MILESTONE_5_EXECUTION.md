# Milestone 5 — Pilot Hardening Execution

Status: **Remediation underway**

Base: `342fea896d44e4224fddfe705f7ea92d0292c933` (frozen Milestone 4)

Branch: `milestone/5-pilot-hardening`

## Objective and scope

Make the existing MVP safe, tested, observable, recoverable, and operationally ready for a small pilot. This is a hardening milestone only. Wave 2 product features, architectural rewrites, and speculative refactors remain out of scope. The frozen M4 coaching boundary remains HEAD_COACH or ASSISTANT_COACH for the exact active team; TEAM_MANAGER, Guardian, and CLUB_ADMIN-only remain denied.

The required release evidence is tracked in [MILESTONE_5_RELEASE_EVIDENCE.md](MILESTONE_5_RELEASE_EVIDENCE.md). Production release remains separately blocked while the accepted dependency exception says `productionStatus: BLOCKED`.

## Immutable start-state verification

Verified before work began:

- `origin/main`, `milestone-4`, `pre-milestone-5`, and `checkpoint/pre-milestone-5` resolve to the frozen M4 SHA above.
- Initial worktree was clean; execution is on `milestone/5-pilot-hardening`.
- Node `v24.21.0`; pnpm `12.9.1`.
- M4 recovery refs were not changed.

## Wave A — read-only release audit

Four reviewers inspected isolated detached worktrees at the frozen base. They made no changes and ran no hosted or destructive operations.

| Workstream | Initial finding | Priority / owner |
|---|---|---|
| Critical E2E | No composed guardian invite → auth → child/team → Game Day → RSVP path. No E2E for coach auth → stats → review → next-practice focus → planner. Recovery has component/session tests but no complete recovery journey. | P1 release evidence gap; Web/Mobile E2E owners |
| Security/privacy/observability | Sentry/PostHog are not connected to app runtimes; capture helpers no-op without a sink. A new M5 migration scopes M4 audit rows by an active coach on an active exact team; an independent review found and drove closure of the missing active-team check. The complete local pgTAP suite now passes all 913 assertions, including admin-only, manager, guardian, revoked, and other-team denies. | P1 observability gate; audit metadata fix verified locally; Coordinator |
| Accessibility/performance | No measured performance baseline. App UI code is outside current package coverage thresholds. No current accessibility review evidence or device session. Game Day online/offline titles lack header semantics; browser E2E uses desktop-only viewport. | P1 evidence gates; one concrete mobile semantics fix; Web/Mobile QA |
| Operations/environment/mobile | EAS preview initially hard-coded `https://staging.invalid` and omitted the staging publishable key (repository config now selects the EAS `preview` environment; the actual staging variables still need external verification). No backup/restore runbook or drill evidence, no pilot-specific synthetic setup/operator procedure, and no TestFlight/Android internal build evidence. | P1 readiness gates; Coordinator + Mobile/Ops |

### External status found during audit

- GitHub confirms the M4 PR's eight required jobs passed on its exact head. Vercel Preview failed separately.
- `apps/web/vercel.json` allows non-production previews and skips production builds; no repository-side root mismatch was found. The failed deployment details could not be read: the installed Vercel CLI reports that it cannot find the deployment in the current account context. Preview cause and dashboard environment are therefore **unverified**, not classified as a repository defect or fixed.
- GitHub's current reviewed advisory records continue to report no patched versions for the accepted High advisories affecting `node-forge` and `braces`. No override or suppression is justified. If no supported upstream fix appears, production remains NO-GO; pilot and production decisions will be reported separately.
- Staging project access/configuration, backup retention, Sentry event receipt, and Apple/Google/EAS account/signing state require external evidence. No hosted resource or credential was accessed.

## Remediation ownership and boundaries

The coordinator owns shared contracts, authorization/privacy decisions, SQL migration ordering, generated types, CI, common environment configuration, integration, and release documentation. Independent writers must use isolated worktrees, own disjoint paths, and return changed files, commit SHA, tests, findings, assumptions, and unresolved issues. No implementation begins until this audit is consolidated.

Planned remediation lanes, subject to path and contract review before dispatch:

1. **Mobile runtime / staging configuration:** select EAS `preview` for the internal preview profile and keep staging URL/publishable key in that external environment; verify its values and build target before distribution. Repository config fix is committed; no account or secret was created. Remote values, TestFlight, Android internal build, push setup, and app-owner credentials remain unverified.
2. **Critical journey coverage:** authenticated Playwright passes 20/20 on isolated local Supabase, including email/phone OTP, magic-link/sign-out, invitation safety, admin fixture/duty/fill-in, outsider denial, guardian invite → child/team → Game Day → RSVP, and active-coach stats → review → next-practice focus → planner. The parameterized Inbucket URL enforces loopback isolation, and bootstrap gives guardian journeys a dedicated synthetic account. Manager-only workflow, cross-team E2E, and deeper auth-recovery journeys remain open. Offline locator/snapshot failure tests are integrated; `planning/OFFLINE.md` records the frozen read-only/refresh behavior.
3. **Accessibility and performance evidence:** expose Game Day headers, add app/offline and responsive browser checks, and establish repeatable baseline measurements. Focused mobile and web checks pass; device/manual review and performance measurements remain pending. Optimize only measured bottlenecks.
4. **Operations evidence:** added backup/restore, production configuration, and first-team operator procedures. A local dump → migration rebuild → public data restore → pgTAP rehearsal passes in two disposable local projects. Hosted backup retention and Storage-object recovery remain staging-owner verification; no hosted restore or mutation occurred.
5. **Observability:** the shared capture helper now forwards a constant exception message and bounded classification, never raw message/context. Focused package tests pass. Sentry remains unwired in app runtimes and no synthetic delivery, environment tag, source-map, or external Sentry project verification is claimed; staging DSN/project-owner setup and event receipt remain explicit release gates.
6. **Audit privacy:** M5 scopes generic M4 lifecycle audit rows to active coaches for an active exact team. Full pgTAP tests cover coach allow and admin-only, manager, guardian, revoked, other-team, and deactivated-team denial; local pgTAP passes 23 files / 913 assertions before and after Auth bootstrap. The independent finding is remediated and requires final-head re-review.
7. **Vercel:** obtain read-only deployment log/settings evidence if access becomes available; make repository-only preview-safe changes only when the failure cause is evidenced. No linking, deployment, production configuration, or secrets changes.

## Independent review remediation

Initial independent reads of candidate `bc7a02f1c090d744f865fc671fc2ccbc64bbb3de` found actionable P2 issues: audit metadata remained visible after team deactivation; mobile React Query data was not cleared on logout/account switch; mobile announcement actions lacked 44-point targets and screen-reader error announcements; web sign-in step changes did not move focus. Remediation and focused tests are now present in the working tree. The reviewers must re-check the final candidate SHA before these items can be considered closed.

## Verification gates

- Preserve Node `24.21.0` and pnpm `12.9.1`.
- Focused tests for each changed boundary, then repository-equivalent full local gate from `planning/TESTING.md`, including local Supabase safety guard, pgTAP, integration, Playwright/auth, Expo, and Maestro validation.
- Meet hand-written testable code coverage targets (lines/statements/functions ≥95%, branches ≥90%; critical permission/domain policy branches 100% where meaningful) without lowering thresholds or blanket exclusions. Integrated app coverage now meets target: web 98.18% lines / 98.21% statements / 98.95% functions / 92.81% branches (25 files, 127 tests); mobile 95.55% lines / 95.48% statements / 96.75% functions / 92.88% branches (18 suites, 147 tests). `pnpm test` passes 47 Turbo tasks. Keep targets at lines/statements/functions ≥95% and branches ≥90%; do not add blanket app UI exclusions.
- All eight required GitHub Actions checks must pass on the exact PR head: quality, dependency-audit, supabase, web-build, expo, playwright, playwright-auth, maestro.
- Six independent read-only exit reviews after implementation and local gates: security/privacy/authorization; database/RLS/migration/concurrency; auth/offline/recovery; accessibility/UX failure states; release/operations/environment; M0–M4 regression. Reviewers must not be implementation agents.
- No merge is authorized by this execution. Report the final candidate and wait for human approval at the merge boundary.

## Unresolved human gates

- Any destructive hosted staging restore, hosted Supabase mutation, production migration/deployment, production submission, credential rotation, account-owner/MFA action, new paid infrastructure, or irreversible remote action.
- External setup/verification for staging Supabase, Vercel Preview environment/log access, Sentry receipt, EAS signing/build distribution, and Apple/Google tester/account state when repository-side work is complete.
- Any change to frozen authorization semantics, child privacy defaults, or acceptance of an actionable Medium or Critical/High security issue.

## Final evidence checklist

Populate [MILESTONE_5_RELEASE_EVIDENCE.md](MILESTONE_5_RELEASE_EVIDENCE.md) with candidate SHA, migration list, full test/coverage/pgTAP counts, critical journeys, accessibility and performance results, offline/auth recovery, security/privacy/audit reviews, Sentry, Vercel, backup/restore, internal builds, advisories, known issues, human gates, separate pilot and production decisions, all eight CI jobs, and final repository state. Do not store secrets or real child data.
