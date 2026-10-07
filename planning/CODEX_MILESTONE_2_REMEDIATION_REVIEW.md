# Codex Delta Review — M2-MED-01 Offline Snapshot Cold Launch

## Reviewed range

- Baseline: `2589793` (`docs(milestone-2): record integrated Codex review`).
- Remediation HEAD: `a8483fa50ce089e38e88fe34137e3511073e5db6` (`fix(offline): restore game day snapshot on cold launch`).
- Reviewed only the remediation commit; its parent contains the integrated Milestone 2 review.
- The worktree was clean before review.
- Delta: 12 changed implementation, dependency, and test files; 1,249 insertions and 49 deletions.
- `git diff --check HEAD^..HEAD` passed.

## Result

**PASS — M2-MED-01 CLOSED.** No new Critical, High, or Medium issue was found in the remediation delta.

## Finding closure

The authenticated gate now supplies the locally restored session’s user ID to the mobile destinations. The Game Day screen can therefore read the stored offline locator and snapshot before a network-backed club context is available. The locator contains only version, user ID, and team ID; the snapshot is written before its locator, reads verify the user/team match, and malformed or mismatched values fail closed.

The production route subscribes to Expo network state and supplies it to the screen. When offline, the screen skips the network context and Game Day queries and renders the user-scoped SecureStore snapshot read-only. When connectivity returns, it reloads authoritative context and Game Day data before replacing the cached snapshot. An authoritative context that no longer permits the stored team, or an authorization failure, hides and clears that user’s stored snapshot. Sign-out clears both snapshots and the locator.

This closes the reviewed cold-start failure: the snapshot is no longer gated on successfully loading team context from the network.

## Focused verification

- `pnpm --filter @stable/mobile test` — PASS, 16 suites / 90 tests, including cold offline launch, user separation, offline read-only behavior, reconnect refresh, and loss-of-access cleanup.
- `pnpm --filter @stable/mobile typecheck` — PASS.
- `git diff --check HEAD^..HEAD` — PASS.
- Commands ran with Node 24.19.0; the workspace declares 24.21.0 and pnpm emitted the existing engine warning.

No product code was changed during this review. The only new worktree file is this delta review.
