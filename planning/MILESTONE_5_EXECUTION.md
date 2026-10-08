# Milestone 5 — Pilot Hardening Execution

Status: **Wave A audit complete; remediation not started**

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
| Security/privacy/observability | Sentry/PostHog are not connected to app runtimes; capture helpers no-op without a sink. Generic club-readable `audit_events` includes M4 stat-correction and private-note lifecycle metadata with player UUID targets; verify against restricted-history/privacy contract. Existing correction detail and private-note contents have coach-only tests. | P1 observability gate; P2 metadata access review; Coordinator + DB/security |
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

1. **Mobile runtime / staging configuration:** select EAS `preview` for the internal preview profile and keep staging URL/publishable key in that external environment; verify its values and build target before distribution. No account or secret creation.
2. **Critical journey coverage:** add non-superficial browser/device-boundary flows for guardian Game Day/RSVP and M4 coaching; cover auth recovery and offline failure scenarios without weakening the M2 read-only offline rule.
3. **Accessibility and performance evidence:** address Game Day header semantics, add appropriately scoped app UI coverage, viewport/keyboard/device checks, and repeatable baseline measurements. Optimize only measured bottlenecks.
4. **Operations evidence:** add backup/restore runbook and disposable local rehearsal, staging-only pilot configuration procedure, and production configuration checklist. No hosted restore or mutation.
5. **Observability:** integrate or precisely document external setup gates for staging Sentry. Any integration must minimize event fields and prove scrubbing with synthetic errors; do not send child data.
6. **Audit privacy:** coordinator to determine whether generic M4 lifecycle events disclose restricted history; add a narrowly scoped SQL/RLS regression test and remediation if evidence confirms cross-role visibility violates the frozen contract.
7. **Vercel:** obtain read-only deployment log/settings evidence if access becomes available; make repository-only preview-safe changes only when the failure cause is evidenced. No linking, deployment, production configuration, or secrets changes.

## Verification gates

- Preserve Node `24.21.0` and pnpm `12.9.1`.
- Focused tests for each changed boundary, then repository-equivalent full local gate from `planning/TESTING.md`, including local Supabase safety guard, pgTAP, integration, Playwright/auth, Expo, and Maestro validation.
- Meet hand-written testable code coverage targets (lines/statements/functions ≥95%, branches ≥90%; critical permission/domain policy branches 100% where meaningful) without lowering thresholds or blanket exclusions.
- All eight required GitHub Actions checks must pass on the exact PR head: quality, dependency-audit, supabase, web-build, expo, playwright, playwright-auth, maestro.
- Six independent read-only exit reviews after implementation and local gates: security/privacy/authorization; database/RLS/migration/concurrency; auth/offline/recovery; accessibility/UX failure states; release/operations/environment; M0–M4 regression. Reviewers must not be implementation agents.
- No merge is authorized by this execution. Report the final candidate and wait for human approval at the merge boundary.

## Unresolved human gates

- Any destructive hosted staging restore, hosted Supabase mutation, production migration/deployment, production submission, credential rotation, account-owner/MFA action, new paid infrastructure, or irreversible remote action.
- External setup/verification for staging Supabase, Vercel Preview environment/log access, Sentry receipt, EAS signing/build distribution, and Apple/Google tester/account state when repository-side work is complete.
- Any change to frozen authorization semantics, child privacy defaults, or acceptance of an actionable Medium or Critical/High security issue.

## Final evidence checklist

Populate [MILESTONE_5_RELEASE_EVIDENCE.md](MILESTONE_5_RELEASE_EVIDENCE.md) with candidate SHA, migration list, full test/coverage/pgTAP counts, critical journeys, accessibility and performance results, offline/auth recovery, security/privacy/audit reviews, Sentry, Vercel, backup/restore, internal builds, advisories, known issues, human gates, separate pilot and production decisions, all eight CI jobs, and final repository state. Do not store secrets or real child data.
