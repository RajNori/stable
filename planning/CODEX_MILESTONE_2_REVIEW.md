# Codex Integrated Review — Milestone 2 Weekly Basketball Loop

## Reviewed range

- Baseline: `milestone-1` at `c30dca5`.
- Reviewed HEAD: `893d666c8e5b439aeea80df6bbb7b03b40447dd5`.
- Baseline is an ancestor of HEAD; the initial worktree was clean.
- Reviewed commits, oldest first:
  - `7ec6820eeeae2fcfcffb9e7ee048ca553acfc890` — `feat(fixtures): add manual and imported official fixtures`
  - `e9c167c4969ab47e62748f85eea9bc572ae7d23c` — `feat(schedule): add one chronological team agenda`
  - `1ef66937468013b30ceb6e272ca32898f0f3561e` — `feat(game-day): add the team game day projection`
  - `6adc44c375e7c7b731e5987926e77b37a6287a81` — `feat(attendance): record managed-player responses`
  - `f3e55b058a54b0da2a984ba1a30a0a76758132a3` — `feat(training): add weekly series and coach check-in`
  - `9ddb231baed44cd5bc2d5020468314ad950bcc9a` — `feat(offline): cache a read-only game day snapshot`
  - `4beaba98fa7eb39ad7a010c4df9d617180ce6692` — `style(offline): format the game day snapshot`
  - `893d666c8e5b439aeea80df6bbb7b03b40447dd5` — `chore(mobile): align Expo SDK 57 patch dependencies`
- Diff: 96 changed files, 12,532 insertions and 157 deletions.
- `git diff --check milestone-1..HEAD` passed.

## Executive result

**PASS WITH CONDITIONS.** The integrated feature set has sound database authorization boundaries for fixtures, schedule, Game Day, attendance, duties, and training. No Critical or High finding was identified. One Medium functional finding remains: the persisted offline Game Day snapshot cannot be opened after a cold app launch without connectivity because the screen requires a network-backed team context before it can look up the local snapshot.

## Scope

Reviewed the complete Milestone 2 delta across all 96 paths: five database migrations and their pgTAP coverage; feature commands and Supabase gateways; web routes/actions and panels; mobile schedule and Game Day screens; offline snapshot storage and auth lifecycle; capability additions; and lockfile/runtime changes. Read the applicable repository instructions and the Milestone 2 plan, feature scope, architecture, contracts, data model, permissions, security, testing, offline requirements, and relevant accepted ADRs.

The implementation covers manual and imported official fixtures with a separate Stable-owned team overlay, one chronological event schedule, a Game Day projection, guardian-managed attendance responses, weekly training recurrence and coach check-in, and a read-only mobile Game Day snapshot. It adds no analytics event collection or analytics capability in the Milestone 2 delta.

## Integrated authorization review

- Authenticated clients have no direct table privileges on the new event, game, overlay, PlayHQ mapping, duty, attendance, recurrence, and training-session tables. Writes and protected reads use narrowly granted RPCs; the `SECURITY DEFINER` functions pin `search_path` to the empty string and helper functions remain ungranted to API roles.
- Fixture RPCs derive active team/club facts from the database. Manual fixture and overlay writes use role-specific checks; official/import fields remain separate from team overlay fields. External fixture identity is unique per club and the import seam does not introduce a PlayHQ client or synchronization job.
- Schedule and Game Day reads recheck the caller’s active team or guardian-registration chain in SQL. The Game Day projection withholds team-wide counts from guardians and returns only a guardian’s own linked player response and assigned duty.
- Attendance writes require the authenticated guardian’s active relationship to the target player and an active registration to the event’s team. Staff attendance reads are separately authorized. Duty assignment validates the target user against current club/team/guardian facts and writes an audit event in the same transaction.
- Training management and coach check-in use separate database role checks. Recurrence materialization and edit operations lock the series or affected events and audit successful changes.
- Offline snapshots use `expo-secure-store`, are versioned and keyed by user and team, contain no guardian contact data or private attendance note, and are cleared for the user by the production local sign-out path. Offline UI presents no mutation controls and marks old snapshots stale.

## Verification evidence

**RERUN**

- `pnpm format:check` — PASS.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS, 20 workspace projects.
- `pnpm test` — PASS, 37 workspace tasks; mobile 68 tests and web 76 tests passed.
- `pnpm exec supabase test db` against the local Stable database — PASS, 11 SQL test files / 589 assertions, including every Milestone 2 RLS suite.
- Local migration list showed all five Milestone 2 migrations applied. The SQL test files wrap synthetic rows in transactions and roll them back.
- `git diff --check milestone-1..HEAD` — PASS.

The configured Node runtime is 24.19.0 while the workspace declares 24.21.0; the commands completed successfully with the engine warning. The database checks used the local Supabase stack only. No hosted environment was accessed or modified.

## Findings

### M2-MED-01 — Persisted Game Day snapshot is unavailable on a cold offline launch

- **Severity:** MEDIUM
- **Path/symbol:** `apps/mobile/src/team-game-day-screen.tsx:57-79, 114-145`; production wiring in `apps/mobile/app/index.tsx:70-74`.
- **Concrete behaviour:** The Game Day screen first runs `loadContext` and derives both `userId` and `teamId` from the returned network-backed context. The SecureStore snapshot query is disabled until those values exist. On a fresh app process started without network access, the context request fails, `teamId` remains null, and the screen renders the context error branch without looking up the saved snapshot. The production route supplies `snapshotStore` but does not provide offline identity/team context; the screen’s `online` option defaults to `true`.
- **Impact:** A snapshot written during a prior online session is not readable in the cold-start/poor-reception case that the offline feature is intended to support. It is available after context has already loaded in the current process, so this is a functional availability gap rather than a cross-user disclosure.
- **Evidence:** The context query is unconditional at lines 57–61; local snapshot lookup is enabled only when `userId` and `teamId` have been derived at lines 62–79; the context-error branch returns before rendering the offline snapshot at lines 133–145. Production route wiring passes no `online` state or offline context store.
- **Required remediation:** Persist the minimum identity/team lookup needed to locate the authenticated user’s snapshot, or otherwise resolve the current user/team locally before the offline branch. Add a cold-start offline test that begins with an empty query cache and confirms the saved snapshot renders without invoking a successful context network request.

## Freeze recommendation

**PASS WITH CONDITIONS.** Resolve M2-MED-01 before treating the offline snapshot slice as complete. The remaining Milestone 2 feature boundaries and local verification gates passed review.

## Repository hygiene

This review changed no product code and created no commit, tag, or push. The review report is the only review artifact added to the checkout.
