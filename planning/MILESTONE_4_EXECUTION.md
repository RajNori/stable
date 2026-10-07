# Milestone 4 Coaching Loop — Frozen Execution Contract

**Status: CONTRACT-FROZEN.** Shared decisions recorded 2026-10-07; final coaching authorization boundary frozen 2026-10-08. Do not reopen unless implementation reveals a direct conflict with an accepted ADR or security invariant.

## Entry conditions

- Milestone 3 integrated review: PASS; no unresolved Critical, High, or Medium freeze condition.
- CI-only PR #1 merged to `main`; all eight required jobs passed on the PR and post-merge run.
- Work is on `milestone/4-coaching-loop`, based on `origin/main` at `b52500fb4a26687201b274cba8ee9fa3b710312d`.
- No production deployment, hosted Supabase mutation, paid infrastructure, or CI bypass.

## Shared invariants

- Players are child domain records, not authenticated users. Derive authorization from active contextual memberships and enforce it in application capabilities and SQL/RLS.
- Current team membership is checked on each request; revoked membership immediately loses M4 access.
- Active Head and Assistant Coaches have the same M4 coaching capabilities for their assigned team. No delegation mechanism in MVP.
- Every M4 coaching capability requires active `HEAD_COACH` or `ASSISTANT_COACH` membership for the exact active team. `CLUB_ADMIN` authority alone grants no M4 coaching access. A dual-role Club Admin is authorized only through current team-coach membership; revoking it removes M4 access immediately.
- Team Managers and Guardians receive no M4 coaching capability. Dual-role actors act only through the role/membership that grants the requested capability.
- Ordinary fixture/game projection access remains unchanged. A Club Admin may see a final score if an existing non-M4 projection already exposes it; this does not grant `coaching_stats.read`, player-stat, or correction-history access.
- Private player-note text never enters analytics, logs, notifications, generic audit metadata, broad game/fixture projections or offline snapshots. Correction history has opaque game/player IDs, actor/time and before/after numeric stats only; no names and no Guardian access.
- M2 offline Game Day remains read-only. No AI coaching or public leaderboard.

## Slice 4.1 — Game score and player statistics

### Score

- A score command writes only `MANUAL` game results. Team score and opponent score are paired integers in `[0, 250]`; a final result has both values and `result_status = FINAL`. Imported/PlayHQ result data is never modified by M4.
- Score save/correction is a dedicated command requiring `coaching_stats.write`. Do not inherit `fixture.manage_manual` Team Manager access.
- The legacy fixture metadata update must preserve existing scores and must not mutate score fields. It must not update imported/provider-owned official fixture fields. This prevents metadata edits from clearing scores and closes the old RPC permission path.
- Final score can be saved independently of the player stat sheet. Each command, its generic audit event and its history write are atomic.

### Player statistics

- One row per `(game_event_id, player_id)`, with game/team/club consistency derived in SQL. Stats are Stable-owned and can be recorded for a valid game regardless of fixture source.
- `points`, `rebounds`, `assists`, `steals`: whole integers `[0, 100]`; `fouls`: whole integer `[0, 20]`.
- `approximate_minutes`: whole non-negative integer; no greater than the scheduled event duration (`events.ends_at - events.starts_at`) in whole minutes when both timestamps exist; otherwise no greater than 120.
- Creating a new stat line requires an active player currently registered to the game team. Correcting an existing line requires an authorized `coaching_stats.write` actor with active Head/Assistant Coach membership scoped to that game team, but does not recheck registration; the row itself is historical evidence. Do not add roster snapshots or permit a new ineligible historical line.
- Every actual correction appends an immutable restricted revision with opaque game/event and player IDs, actor ID, timestamp, before numeric values and after numeric values. No child names. Generic audit contains only opaque action/target metadata.

## Slice 4.2 — Post-game review

- One review per GAME event has separate `what worked` and `what needs improvement` fields, each max 2,000 characters. Save creates/updates a draft; explicit completion sets `completed_by/completed_at`; edits reopen; an authorized M4 writer may re-complete it. An authorized M4 review writer can edit/reopen and re-complete it. Audit lifecycle actions with opaque IDs only.
- Private player note: one per game/player, max 2,000 characters, `STAFF_PRIVATE`. Only active Head/Assistant Coach membership for that team may read or write. Club Admin alone, Team Manager and Guardian are denied. A user who is also a team Coach is allowed through that active coaching membership.
- Recognition categories are exactly `MVP`, `HUSTLE`, `DEFENCE`, and `TEAMWORK`. At most one MVP recipient per game; a player may receive each non-MVP category once per game. Optional recognition note is staff-only and max 500 characters. No ranking, public aggregation or leaderboard.
- Focus codes are exactly `SHOOTING`, `BALL_HANDLING`, `PASSING`, `REBOUNDING`, `DEFENCE`, `COMMUNICATION`, `TEAMWORK`, `TRANSITION`; at most five unique codes per review. A code can be explicitly selected into a same-team training plan. Plan selection stores a durable snapshot; later review edits do not silently change it. Private-note text is never a focus source.

## Slice 4.3 — Thin practice planner

- A plan is either attached to one TRAINING event or a reusable template. Blocks have stable unique order, positive whole-minute duration, and either a same-team drill reference or a title. Instructions max 2,000 characters; plan title max 120 and notes max 2,000.
- Reorder, duplicate-previous and template application are atomic. Copies snapshot the source values and never mutate their source. A linked plan’s total duration cannot exceed the scheduled training duration when known; otherwise cap at 240 minutes.
- Review focus is explicitly selected, same-team, and copied as typed code/source reference. Cross-team, private-note, and invalid/inactive references are denied.

## Acceptance and implementation gates

- Write acceptance tests before implementation. Unit/domain/gateway, pgTAP RLS/invariant/concurrency, web component and critical E2E coverage follow `planning/TESTING.md`.
- 4.1 tests cover score pairing/bounds/source immutability, legacy metadata preservation, manager/guardian/revoked/cross-team denial, roster-create vs historical-correction behavior, minutes caps, correction history, retries and concurrent writes.
- 4.2 tests cover every role, admin-only private-note denial, dual-role allow, note isolation, recognition cardinality, review lifecycle and audit privacy.
- 4.3 tests cover event type/team ownership, duration bounds, stable reorder, immutable copies, explicit focus snapshot and stale/cross-team rejection.
- No feature data is added to the existing mobile offline Game Day projection.
- After all slices: full local CI-equivalent gate, push branch, open/update PR, wait for all eight GitHub Actions jobs. Then independent read-only security/privacy, database/RLS/concurrency, correctness/domain and regression reviews; coordinator performs integrated review. No merge or freeze tag while a concrete Medium+ finding or red required job remains.

## Ownership and sequencing

- **Wave A:** Agent A owns the isolated 4.1 feature, tests and one additive 4.1 migration (including the legacy fixture score-path guard). Coordinator owns shared capability/permission definitions and generated database types. Agent B’s read-only 4.2 exploration is complete; its findings informed this contract.
- **Coordinator checkpoint:** inspect Agent A’s complete diff; integrate; regenerate/update database types; run 4.1 gates; then freeze any 4.2-to-4.3 shared contract already specified above.
- **Wave B:** Agent B implements 4.2 in a separate worktree after Wave A integration. Agent C implements 4.3 in a separate worktree after the frozen focus-to-plan interface is implemented and reviewed. No overlapping migration/function/generated-file ownership.
- Each implementation agent returns task, changed files, commit SHA, tests, assumptions and unresolved issues. Coordinator inspects every diff before integration.
