# Codex Integrated Review — Milestone 3 Communication and Operations

## Reviewed range

- Baseline: `milestone-2` (`191b96f87c11d4a6e25521881c0d4f4efe6e6518`)
- Range: `milestone-2..HEAD`
- `milestone-2` exists and is an ancestor of HEAD.
- The review began from a clean tree. The only untracked item was the genuine M2 remediation review record; it was committed docs-only as `eaee268` before this review, leaving a clean tree.
- Commits in range: `60aab72`, `e11147e`, `cd6e84a`, `2fbcd6a`, `ec0e4c5`, `b9c6f4c`, `9403f63`, and docs-only `eaee268`. Each commit and each changed path was inspected. The docs-only commit is included because it is after the requested baseline.
- `git diff --check milestone-2..HEAD`: PASS.

## Reviewed SHA

`eaee268f9a9587ef74bf5f70abd059942cdc5da5`

## Executive result

**FAIL.** A game can acquire multiple confirmed fill-ins through sequential requests. The Game Day projection hides all but the earliest confirmation, while later confirmations and their notifications remain authoritative records. This is a split-brain operational state and violates the one-final-candidate requirement.

Additional medium findings concern stale duty acknowledgement, stale guardian consent and invalid games in the fill-in flow, cross-user device-token reassignment, and missing producers for two MVP notification types.

## Scope

Reviewed Milestone 3 changes against `milestone-2` and the required planning documents/accepted ADRs. No Milestone 4 implementation was found in app, package, or M3 migration paths. No score/stat capture, player stats, post-game review, MVP/recognition categories, development-focus tags, or practice planner implementation was found.

The prior M2 remediation note commit changes documentation only. No product files were changed during review. The review file is intentionally uncommitted.

## Authorization model

The reviewed paths continue to use contextual club/team checks and SQL authority. M3 adds no global `user.role` or auth-metadata role. Sensitive tables use forced RLS and revoke direct access from `PUBLIC`, `anon`, and `authenticated`; intended client operations go through constrained functions. Team, club, active membership, guardian relationship, and active-player checks are generally applied in the database. No unrestricted adult-child messaging path was introduced.

The stale acknowledgement and fill-in consent findings below are exceptions where a prior assignment/response is accepted without rechecking current authorization state.

## Announcements

Publish, edit, archive, list, read, and acknowledgement paths are implemented through privileged database functions. Publish/edit/archive check current contextual authority and team/club agreement. Reads require current team visibility; outsider reads fail. Announcement payloads are bounded and content is not included in the push payload. The announcement table and acknowledgement data are not directly accessible to authenticated clients.

## Announcement acknowledgement

Acknowledgement is bound to `auth.uid()`, requires a readable, non-archived announcement with acknowledgement required, and uses a unique `(announcement_id, user_id)` key with conflict-safe insertion. Replay does not create another audit row in the function logic. The local pgTAP rerun had aggregate audit-count failures; see Test evidence.

## Notification architecture

The database has a service-role-only request outbox and delivery log, plus a pure application delivery decision function and provider port. Push is derived from domain records and does not become source of truth. Enqueue operations use a unique `(notification_type, source_id, recipient_user_id)` key. Provider results recheck current eligibility and category preference before recording a result. Invalid-token handling is scoped to the request recipient and leaves a request pending if other active endpoints remain.

The repository contains a fake Expo port and no production provider/worker invocation. Live provider configuration is treated as deferred per the review brief; delivery runtime and retry behavior therefore remain source-review-only. The current SQL result handler records terminal `FAILED` for generic errors and does not itself schedule a retry. At-least-once sends after a timeout remain possible and need a concrete worker retry policy before production delivery is enabled.

## Device token security

`register_device_endpoint` derives the owner from `auth.uid()` and accepts no caller-supplied user ID. Token rows are hidden from normal client reads, service-role-only at table level, and token values are absent from the inspected notification payloads, audit writes, and application logs.

**Finding M3-MED-04:** the unique-token upsert changes `user_id` to the current caller on conflict. Any authenticated caller who obtains another user’s token can claim it and route the caller’s future notifications to that endpoint. The pgTAP suite explicitly asserts that registration transfers ownership. This creates a wrong-user push path and relies on possession of the token alone as proof of endpoint ownership.

## Notification privacy

Inspected push data contains notification type and team/announcement/request identifiers or category. It does not include child full names, guardian contacts, attendance/private notes, invitation secrets, tokens, or raw provider data. Fill-in names are masked in the SQL display projections. The lock-screen payload is identifier-only. No new analytics or audit metadata containing sensitive values was found.

## Notification retry/idempotency

Producer inserts are idempotent by event key. Delivery decisions stop after an `OK`; invalid tokens are collected for deactivation. A provider timeout after delivery can cause a repeated send if an external worker retries, which is bounded at-least-once behavior rather than exactly-once. The SQL delivery result path and current test port do not demonstrate a production retry scheduler or attempt counter increments; no such runtime was found in the repo.

## Duties

M3 retains the existing duty/assignment tables as the authoritative model. Open duty creation, allocation, acknowledgement, and swaps update those records directly. Preview reads candidate counts and open duties without inserting assignments, audit, or notification rows.

## Fair allocation

Eligibility is resolved from active club admins, active team memberships, and active guardians of active players registered to the target team. History counts prior assignments for that team; deterministic user-ID tie ordering is used. The proposal algorithm increments the selected candidate count while assigning multiple duties. Commit locks the event, recomputes the fingerprint, checks current actor authority and candidate eligibility, and inserts assignments and audit in one transaction.

## Duty acknowledgement

**Finding M3-MED-01:** `acknowledge_own_game_duty` checks that the caller is the current `assigned_user_id`, but it does not revalidate that the assignee remains currently eligible for the team or that their contextual relationship remains active. A staff member or guardian whose authority was revoked after assignment can still acknowledge it. Replays are idempotent because only null `acknowledged_at` rows are updated and audited.

## Duty swaps

Requests are tied to the requester’s current assignment. Acceptance serializes on the request, assignment, and event rows; checks the request is open, the assignment still belongs to the requester, the event remains a scheduled game, target restrictions, and current accepter eligibility; then transfers assignment and resolves request in one transaction. Two simultaneous acceptances of one request have a single row-lock winner. Cancellation is requester-only and open-state-only. The accepted-swap notification is idempotently enqueued for the requester.

## Swap concurrency

The row locks and status/ownership checks provide single-winner behavior for one request. Assignment transfer, request resolution, and audit are in the same transaction. The review did not find duplicate-success notification behavior for the same accepted request.

## Fill-ins

Creator authority is enforced in SQL for active Club Admin, Head Coach, and Team Manager; Assistant Coach is not included. Request creation requires an active scheduled GAME and locks the event. Direct table access is revoked. Guardian response requires authenticated caller, current active guardian link, active player, and candidate eligibility, and duplicate response insertion is idempotent.

## Fill-in eligibility/privacy

Candidate queries are team-scoped and require an active target team and active player in the same club who is not registered to that team. Staff sees masked first name plus surname initial; guardians see only their own managed players that qualify. Response lists and Game Day projection also use the masked-name helper. No full child/adult directory or guardian contact list is returned.

## Fill-in response

**Finding M3-MED-02:** a guardian response is persisted with the responding guardian ID, but confirmation later checks only that some response exists for the candidate. It does not recheck that the guardian who supplied the response still has an active guardian relationship. If the relationship is revoked after response but before confirmation, the stale response remains usable as consent.

`respond_fill_in` also checks request status but does not revalidate the associated event’s current type/status. A cancelled or otherwise invalidated game can continue accepting responses.

## Fill-in confirmation concurrency

**Finding M3-HIGH-01:** the unique open-request index and request-row lock serialize requests only per request. They do not enforce one confirmation per event. After the first request becomes `CONFIRMED`, `request_fill_in` can create another request for that same event; a manager can confirm a different candidate on that second request. The confirmation table is unique by `request_id`, not `event_id`. `read_game_day` selects the earliest confirmation and returns only that one, hiding later confirmed candidates while the database and notification outbox retain them. This creates split-brain Game Day state and can notify multiple guardians/candidates.

Required remediation: enforce a single confirmed candidate at the event level in the database and serialize request creation and confirmation against the event row; reject any new request or confirmation once an event has a confirmed fill-in. Add sequential and concurrent different-request confirmation tests.

**Finding M3-MED-03:** `respond_fill_in` and `confirm_fill_in` do not revalidate that the request’s event remains a scheduled GAME. `confirm_fill_in` reads `games.opponent_name` but does not check event status/type or require that a game row was found. If an event is cancelled or invalidated after request creation, responses and confirmation can still succeed and the confirmed player can appear in Game Day.

## Game Day fill-in projection

The projection calls `masked_player_name` in SQL and does not modify official fixture fields or create a roster registration. However, it selects only the earliest confirmation. That limits the displayed leak but masks the event-level split-brain defect rather than preventing it.

## Club Admin visible-team actions

The UI exposes visible-team links/actions, but the database remains authoritative. Relevant club structure writes call SQL functions that recheck active Club Admin authority and same-club scope. UI visibility alone does not grant write authority.

## RLS

New notification, duty-swap, and fill-in tables have RLS enabled and forced, direct grants revoked from client roles, and service-role grants only. Reads and writes are exposed through privileged functions with contextual checks. Announcement read/ack tables also use the restricted RPC pattern. No broad authenticated table policy or direct client write path was introduced in the reviewed M3 migrations.

## SECURITY DEFINER

Reviewed M3 privileged functions; each was checked for `SET search_path = ''`, qualified table/function references, grants, and authorization placement:

- Announcements: `assert_announcement_team`, `publish_announcement`, `edit_announcement`, `archive_announcement`, `list_team_announcements`, `mark_announcement_read`, `acknowledge_announcement`, `list_announcement_acknowledgements`.
- Notifications: `user_can_read_team_announcements`, `register_device_endpoint`, `deactivate_device_endpoint`, `set_notification_preference`, `list_notification_preferences`, `enqueue_announcement_published`, `apply_notification_provider_result` (including later replacements).
- Duties: `create_open_game_duty`, `duty_allocation_candidates`, `duty_allocation_fingerprint`, `commit_duty_allocation`, `acknowledge_own_game_duty`, `list_duty_allocation_inputs`.
- Swaps: `request_duty_swap`, `cancel_duty_swap`, `accept_duty_swap`, `enqueue_duty_swap_accepted`, `apply_notification_provider_result`, `list_open_duty_swaps`.
- Fill-ins/Game Day: `player_is_fill_in_candidate`, `assert_fill_in_manage`, `masked_player_name`, `list_fill_in_candidates`, `request_fill_in`, `respond_fill_in`, `confirm_fill_in`, `list_event_fill_in`, `list_fill_in_responses`, `list_guardian_fill_in_players`, `read_game_day`, `enqueue_fill_in_requested`, `enqueue_fill_in_confirmed`, `apply_notification_provider_result`.

Internal helpers without caller identity are revoked from client roles and only invoked from guarded functions. User-facing mutation functions derive the actor from `auth.uid()`. Provider-result functions are service-role-only.

## Audit

Announcement, duty, swap, and fill-in audit actions use IDs and action enums rather than names, tokens, contacts, or raw payloads. Mutation and audit are generally in one transaction; idempotent acknowledgement/response paths avoid repeated audit in their SQL logic. Local pgTAP audit-count assertions did not pass consistently; see Test evidence and Unverified items.

## Domain-event safety

Outbox payloads inspected contain identifiers and enums rather than arbitrary user content. `ANNOUNCEMENT_PUBLISHED`, `DUTY_SWAP_ACCEPTED`, `FILL_IN_REQUESTED`, and `FILL_IN_CONFIRMED` producers exist. **Finding M3-MED-05:** the notification model lists `DUTY_ASSIGNED` and `DUTY_SWAP_REQUESTED` as MVP types, but no producer was found for either; assigning duties or requesting a swap therefore does not enqueue those expected notifications. No `FILL_IN_RESPONSE` notification type is defined in the MVP notification list, so its absence is not treated as a defect.

## Application boundaries

Server actions validate IDs and enum inputs, resolve the signed-in principal, and delegate to feature commands/gateways. SQL revalidates authority and scope. Raw PostgREST errors are mapped through domain/application errors in the inspected flows. `b9c6f4c` is formatting-only. No client-only authority or raw DB row contract was identified in the reviewed M3 paths.

## Observability / PII

Search and source review found no new token, child-name, guardian-contact, private-note, or announcement-body logging/analytics/audit path. Push payloads are identifier-only. No token is included in normal client reads or URLs in the reviewed features.

## Milestone 2 regression

The M3 changes do not replace the M2 authoritative fixture, attendance, training, offline snapshot, or reconnect models. No offline mutation queue or replay capability was introduced. Fill-in projection is additive and leaves official fixture fields intact. An allocation can still be attempted for a non-scheduled GAME because allocation functions check event type but not scheduled status; this is an operational limitation not elevated separately from the stronger fill-in invalid-event finding.

## Test evidence

Classification: **RERUN** for commands executed in this review; **SOURCE REVIEW** for code and SQL behavior; **REPORTED ONLY** for prior evidence from the supplied brief that was not rerun here.

Rerun results:

- `pnpm format:check`: PASS (Node engine warning: repo requests Node 24.21.0; runtime was 24.19.0).
- `pnpm lint`: PASS (same Node version warning).
- `pnpm typecheck`: PASS, 23 packages (same Node version warning).
- `pnpm --filter @stable/announcements test`: PASS, 13 tests.
- `pnpm --filter @stable/notifications test`: PASS, 7 tests.
- `pnpm --filter @stable/game-day test`: PASS, 15 tests.
- `pnpm --filter @stable/fill-ins test`: PASS, 12 tests.
- `pnpm exec supabase test db`: FAIL in the available local database. It reported 655 tests; failures included audit-count assertions in M2 fixtures, M3 announcements, and M3 duties, plus a scalar-subquery error in `m3_fill_ins_rls.sql` while inspecting `FILL_IN_REQUESTED` payloads. This was not rerun after a local reset; no local reset was performed during this review.
- `git diff --check milestone-2..HEAD`: PASS.

Reported only in the supplied brief: full workspace tests, mobile Jest, web Vitest/build, Playwright suites, Expo checks, local reset, and a prior 666-assertion pgTAP run. These were not rerun here.

## Adversarial scenarios

- Publisher revoked after composer load: SQL publish authority is rechecked at mutation time.
- Guessed announcement ID / outsider list: scoped read/ack checks deny access.
- Duplicate acknowledgement: unique row and idempotent insert.
- Duplicate token registration / cross-user registration: deterministic token upsert, but ownership can transfer (M3-MED-04).
- Preference/revocation before delivery: provider-result function checks current preference/eligibility; production worker retry behavior not present to verify.
- Provider timeout after delivery: duplicate send is possible on retry; at-least-once semantics need worker policy.
- Stale allocation preview / candidate revoked / actor revoked: fingerprint and candidate authorization are recomputed at commit; actor authorization is checked.
- Former duty assignee acknowledgement: not rejected after revocation (M3-MED-01).
- Two users accept one swap / swap after revocation: row locks and current eligibility check provide a single winner and fail closed.
- Withdrawn fill-in / duplicate guardian response: withdrawn request rejected; duplicate response idempotent.
- Candidate joins target team before confirmation: candidate check fails closed.
- Guardian revoked after response: stale consent can still be confirmed (M3-MED-02).
- Candidate inactive / target team inactive: candidate/team checks reject; event cancellation is not revalidated (M3-MED-03).
- Two managers confirm different candidates on separate requests for one event: both can succeed (M3-HIGH-01).
- Guessed fill-in request ID / other-team guardian: manager/guardian/request scope checks deny.
- Confirmed fill-in display: SQL masks surname but hides later confirmations instead of enforcing one per event.

## Repository hygiene

The review began clean after the user-requested docs-only commit `eaee268`. All checks left product files unchanged. The only intended worktree change is this uncommitted review document.

## Findings

### M3-HIGH-01 — Multiple confirmed fill-ins can coexist for one event

- **Severity:** HIGH
- **Path/symbol:** `supabase/migrations/20261007210000_create_fill_ins.sql`: `fill_in_requests_one_open`, `fill_in_confirmations`, `request_fill_in`, `confirm_fill_in`, and `read_game_day`.
- **Concrete behavior:** a confirmed request frees the partial unique open-request slot; another request for the same event can be created and a different candidate confirmed. There is no event-level unique constraint or event lock/check for an existing confirmation. Game Day shows only the earliest confirmation.
- **Impact:** multiple children can be treated/notified as confirmed for one game while Game Day presents only one. This is split-brain operational state and undermines child/guardian expectations.
- **Evidence:** migration lines 71–73 and 84–90; request creation lines 225–247; confirmation lines 333–384; projection lines 672–681. The M3 pgTAP test itself creates another request after confirmation at `supabase/tests/m3_fill_ins_rls.sql:292–293` and later another after withdrawal at line 324, but does not test confirming the later request.
- **Required remediation:** add an event-level database invariant and serialize request/confirm against the event row; reject new requests and confirmations once an event has one confirmed candidate. Add sequential and concurrent two-request confirmation tests.

### M3-MED-01 — Revoked former assignee can acknowledge a duty

- **Severity:** MEDIUM
- **Path/symbol:** `supabase/migrations/20261007190000_allocate_duties.sql`, `acknowledge_own_game_duty`.
- **Concrete behavior:** authorization checks only whether the caller remains the `assigned_user_id`; it does not re-evaluate current eligibility or active membership/guardian relationship.
- **Impact:** a revoked staff member or guardian can still mutate acknowledgement state and create audit history after losing contextual authority.
- **Evidence:** lines 331–355.
- **Required remediation:** revalidate current assignment eligibility and event/team scope in the acknowledgement transaction; add revoked-staff and revoked-guardian cases.

### M3-MED-02 — Fill-in confirmation accepts stale guardian response

- **Severity:** MEDIUM
- **Path/symbol:** `supabase/migrations/20261007210000_create_fill_ins.sql`, `confirm_fill_in`.
- **Concrete behavior:** confirmation checks for any response for the player but not whether the responding guardian still has an active relationship.
- **Impact:** a guardian whose authority was revoked after responding can still supply the consent used to confirm a child.
- **Evidence:** response stores `guardian_user_id` at lines 75–82; confirmation only checks `request_id` and `player_id` at lines 352–359.
- **Required remediation:** require at confirmation time a qualifying response with a currently active guardian relationship, or explicitly withdraw/expire responses when the relationship is revoked; test revocation between response and confirmation.

### M3-MED-03 — Fill-in flow does not revalidate event validity after request creation

- **Severity:** MEDIUM
- **Path/symbol:** `supabase/migrations/20261007210000_create_fill_ins.sql`, `respond_fill_in` and `confirm_fill_in`.
- **Concrete behavior:** request creation requires a scheduled GAME, but response and confirmation only lock/check the request. Confirmation reads the opponent name without checking event status/type or requiring that the game row exists.
- **Impact:** a cancelled or invalidated game can continue collecting responses and be confirmed, including surfacing the masked player in Game Day and enqueueing notifications.
- **Evidence:** creation checks status at lines 225–235; response path at lines 268–294; confirmation path at lines 333–379.
- **Required remediation:** lock and revalidate the event as an active scheduled GAME at response and confirmation; reject stale requests when the fixture is cancelled or invalidated.

### M3-MED-04 — Device token ownership can be reassigned by any authenticated caller

- **Severity:** MEDIUM
- **Path/symbol:** `supabase/migrations/20261007180000_create_notifications.sql`, `register_device_endpoint`.
- **Concrete behavior:** on token conflict, the function overwrites the endpoint `user_id` with the caller without endpoint proof.
- **Impact:** a caller who obtains another user’s token can redirect their own future pushes to that user’s device, exposing the caller’s team activity through a wrong-user lock-screen notification.
- **Evidence:** upsert at lines 186–193; `m3_notifications_rls.sql` asserts transfer behavior at lines 175–189.
- **Required remediation:** bind registration to an authenticated device challenge/ownership flow or reject active cross-user token claims; add a test proving another user cannot take over an active endpoint.

### M3-MED-05 — MVP duty notification producers are missing

- **Severity:** MEDIUM
- **Path/symbol:** notification producers in `supabase/migrations/20261007180000_create_notifications.sql`, `20261007190000_allocate_duties.sql`, and `20261007200000_create_duty_swaps.sql`.
- **Concrete behavior:** `DUTY_ASSIGNED` and `DUTY_SWAP_REQUESTED` are defined as MVP notification types, but no enqueue producer was found for either. Assignment and swap-request mutations therefore do not create the expected recipient notifications.
- **Impact:** users may not learn of assignments or incoming swap requests through the promised notification path.
- **Evidence:** MVP types in `planning/notifications.md`; producer search finds only announcement published, duty swap accepted, fill-in requested, and fill-in confirmed.
- **Required remediation:** add idempotent, recipient-scoped producers in the authoritative mutation transaction (or explicitly remove/defer these types from the M3 contract); test recipient resolution, revocation, preferences, and duplicate suppression.

## Unverified items

- The local Supabase test database produced pgTAP failures and was not reset during review; rerun the database suite after a clean local reset to distinguish stale local fixtures from source/test defects.
- Full Playwright, Expo, production build, and other reported-only gates were not rerun.
- No production push provider/worker exists in the repository; live delivery and retry behavior cannot be verified here.

## Freeze recommendation

**FAIL**
