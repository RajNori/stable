# Slice 1.3 QA / Security Review

Independent review of Milestone 1, Slice 1.3. No product code was changed. Findings were not fixed. Slice 1.4 was not started. Nothing was pushed, tagged, or applied to hosted Supabase.

## Reviewed range

`slice-1.2..HEAD`

`slice-1.2` is an ancestor of `HEAD`. The range is one commit:

- `084a5f9b6cc15079d46168f7bfbcc36eb41a9f10` `feat(players): add child profiles and guardian links`

There is no separate formatting commit. The commit adds player storage, guardian links, import identity, the `@stable/players` slice, and the Club Admin `/players` surface. It does not add Slice 1.4 membership capabilities, Slice 1.5 invitations, or Slice 1.6 roster views.

## Reviewed SHA

- Peeled `slice-1.2`: `87affc2724d42b59dc4307ed9271e79bf73a66e7`
- Implementation commit: `084a5f9b6cc15079d46168f7bfbcc36eb41a9f10`
- `HEAD`: `084a5f9b6cc15079d46168f7bfbcc36eb41a9f10`
- Branch: `main`, one commit ahead of `origin/main`
- Working tree at the start of the review: clean
- Working tree at the end of the review: clean

`next typegen` during this review rewrote `apps/web/next-env.d.ts`. That file was restored. It is not part of the slice.

## Executive result

Player profiles, guardian links, and Club Admin import stay inside the approved slice. A guardian row does not grant a read or a capability. Cross-club id probes return one `NOT_FOUND` failure. The adult picker returns `user_id` and `display_name` only to an active club admin of that club.

Two conditions remain. The new adult-list pgTAP assertion fails on a local database that has already been bootstrapped, so the reported “345 tests, all passed” result is not reproducible here. `pnpm format:check` is red on five files that `slice-1.2` already contained. Freeze should wait until both gates are green.

## Scope verification

The diff is 32 files. Permissions, current-club context, and mobile are unchanged.

Present:

- Child player profiles and conservative display-name derivation
- Many-to-many guardian relationships, including two guardians for one child and one adult linked to two children
- Club-admin import identity and idempotency
- Minimum Club Admin player management at `/players`

Absent from the diff and from the new schema:

- Player authentication and `auth_user_id`
- Guardian-derived capabilities
- Team membership, roster authorization, and invitations
- Guardian self-service
- PlayHQ as a source
- Attendance, Game Day, messaging, and medical fields
- Mobile player-management UI

`packages/features/current-club-context/src/application/get-current-club-context.ts` still sets `managedPlayerIds` to `[]`. `packages/permissions/src/index.ts` still allows only `club.read`, and only for an active `CLUB_ADMIN` membership of the requested club. Neither file is in the diff.

`planning/DATA_MODEL.md` still sketches `preferred_name`, `date_of_birth`, `relationship_label`, and `can_manage`. `planning/DOMAIN_MODEL.md` still describes management permissions on a guardian link. Those belong to later slices. Their absence here matches the approved Slice 1.3 boundary.

## Player privacy/data model

Live `public.players` columns are `id`, `club_id`, `first_name`, `last_name`, `active`, `created_at`, and `updated_at`.

The pgTAP column check, which passed in this run, rejects `auth_user_id`, `email`, `phone`, `date_of_birth`, `team_id`, `display_name`, and `guardian_id`. There is no gender, address, school, medical, preferred-name, or jersey column.

Names are trimmed with ASCII spaces, matching PostgreSQL `btrim`. Empty names and names longer than 80 characters fail. ASCII controls, including newline and DEL (`chr(127)`), fail in `public.player_text`. `Álvarez`, `李`, and a surname that includes U+0301 are accepted. Stored case is preserved. The same human name can be stored twice; identity is the player UUID. A unique `(id, club_id)` key exists so composite foreign keys can enforce the club. Names are not unique.

`public.player_text` and the table checks both reject `[[:cntrl:]]`. The contract rejects code points 0–31 and 127 before a write. The masked display form is not a column.

## Display-name policy

`childDisplayName` in `packages/features/players/src/domain/child-display-name.ts` keeps the trimmed given name, a space, the first Unicode grapheme of the whole surname, and a period. The re-run unit tests confirm:

- Alexander Robertson → `Alexander R.`
- Wei L → `Wei L.`
- Smith-Jones → `S.`
- O'Brien → `O.`
- van der Berg → `v.`
- Álvarez → `Á.`
- 李 stays intact
- `e` plus U+0301 stays one grapheme

An empty or invalid surname throws `PlayerDisplayError`. The message does not contain the supplied name. If `Intl.Segmenter` is missing, derivation throws and does not fall back to the full surname. `registeredPlayerName` is the admin full-name formatter. The mask is derived at render time.

Product call sites for those two functions are the feature package and `apps/web/app/players/page.tsx`. That page is the Club Admin player-management surface, so the registered full name is allowed there. The same surface also renders `Shown to guardians as` plus the masked form. The fixture Playwright spec confirmed both strings for Alexander Robertson. No other product screen builds a child name. The auth end-to-end spec expects the registered name only on that admin list.

## Guardian relationship review

`public.guardian_relationships` is many-to-many: `id`, `club_id`, `player_id`, `user_id`, `active`, `created_at`, `updated_at`. `(player_id, user_id)` is unique. `(player_id, club_id)` references `players (id, club_id)`. `user_id` references `auth.users` with `ON DELETE RESTRICT`.

There is no `players.guardian_id`, relationship label, mother/father field, primary flag, or `can_manage`. Linking does not read or write a capability.

pgTAP on this database passed the relationship cases:

- One child linked to two adults
- One adult linked to two children
- A second link of the same pair leaves one row and does not write a second `guardian.linked` audit
- Unlink sets `active` false and keeps the row
- A second unlink does not write a second audit
- Relink sets the same row active again

Deactivation keeps the player id and existing relationship rows. A new link to an inactive player raises `VALIDATION_FAILED`. The Club Admin form still offers the link control for an inactive player; the command and the SQL function both refuse it with a fixed sentence.

A relationship row inserted for an adult with no membership does not let that adult select players or relationships.

## Tenant isolation

Authorization for id-based changes is inside `lock_administered_player`. The caller must be `auth.uid()`, with an active `CLUB_ADMIN` membership of the player’s club. A missing id, another club’s id, a revoked admin, and a guardian-only adult all raise `NOT_FOUND` (`P0002`). pgTAP compared the error text for a missing id and another club’s real player id and they matched.

Create and import call `assert_club_structure_admin`. A caller who does not administer the named club gets `FORBIDDEN` (`42501`). That path does not look up a child id.

An adult who knows a player UUID cannot self-link. Another club’s admin cannot update or link that player. Both are `NOT_FOUND`. Linking an unknown adult, a non-member, or a revoked member is the same `NOT_FOUND`.

## Adult picker review

`public.list_club_adults(uuid)` is `SECURITY DEFINER`, `search_path` empty, and returns `TABLE(user_id uuid, display_name text)`. The body selects `membership.user_id` and `profile.display_name` for active memberships of `p_club_id`, after confirming the caller is an active `CLUB_ADMIN` of that club. The function definition contains neither `email` nor `phone`. There is no search argument and no global directory.

A live call as the bootstrapped local admin returned one row: that admin’s user id and display name `Local Member`. The same call as the local outsider raised `NOT_FOUND`. A call for a club id that admin does not administer also raised `NOT_FOUND`, so the caller did not receive an empty directory.

The picker is a `<select>` of those two fields. The panel test and the fixture browser spec found no email field and no search box.

The exact-set pgTAP assertion for this function failed on this database. See finding S13-01. The function’s inclusion of the already-bootstrapped club admin is the behaviour the SQL specifies.

## Import/idempotency review

`import_players` accepts a JSON array of at most 50 objects. It validates every row, then looks for a repeated source id, and raises `VALIDATION_FAILED` with a hint of row numbers before any insert. An invalid row or an in-batch duplicate leaves no source identity. The hint parser accepts only the numbers 1–50. A hint that contains a name is discarded.

The source value written by the function is `club_admin_import`. The check constraint rejects `playhq`. Uniqueness is `(club_id, source, source_player_id)`. The same name with two source ids creates two players. A retry of one source id returns `existing`, does not change the stored name, and does not write a second `player.imported` audit.

Two concurrent sessions imported `qa-slice13-race` for the local club. The first returned `created`. The second returned `existing` with the same player id. One source row, one player, and one import audit remained. The stored name stayed `Race Child` even though the second request sent different names. Those probe rows were deleted afterward.

A forced audit-insert failure, covered by the passing pgTAP trigger test, rolls back both `create_player` and `import_players`.

## SECURITY DEFINER review

Reviewed functions, all with `search_path` stored as `search_path=""`, schema-qualified references, and `auth.uid()` as the actor. None takes an actor id.

| Function | Security definer | Execute |
| --- | --- | --- |
| `public.create_player(uuid, text, text)` | yes | `authenticated` only |
| `public.import_players(uuid, jsonb)` | yes | `authenticated` only |
| `public.update_player_identity(uuid, text, text)` | yes | `authenticated` only |
| `public.deactivate_player(uuid)` | yes | `authenticated` only |
| `public.reactivate_player(uuid)` | yes | `authenticated` only |
| `public.link_player_guardian(uuid, uuid)` | yes | `authenticated` only |
| `public.unlink_player_guardian(uuid, uuid)` | yes | `authenticated` only |
| `public.list_club_adults(uuid)` | yes | `authenticated` only |
| `public.lock_administered_player(uuid)` | yes | owner only; revoked from `PUBLIC`, `anon`, and `authenticated` |
| `public.player_text(text)` | no, immutable | owner only; revoked from clients |

Live `proacl` matches that table. `anon` cannot execute the public functions. Create and import also call the existing `public.assert_club_structure_admin(uuid)`, which remains revoked from clients and returns `auth.uid()` only after the same-club admin check.

Application membership checks run first. The SQL functions repeat authorization and are the boundary that PostgREST uses. Unmapped database errors become the fixed save or read sentence. Audit inserts are in the same function transaction as the mutation.

`list_club_adults` output arguments appear in `proargnames` as `user_id` and `display_name`. They are return columns, not an actor parameter.

## RLS review

`players`, `guardian_relationships`, and `player_source_identities` have row security enabled and forced. `authenticated` has `SELECT` only. `anon` has no table privilege. `service_role` has the same data-definition grants as `seasons`, including insert, update, and delete. There is no insert, update, or delete policy.

pgTAP on this database passed the select and write cases:

- `anon` select, insert, update, delete, and function execute: `42501`
- Authenticated outsider: no visible rows; create and import `FORBIDDEN`; id-based update `NOT_FOUND`
- Active same-club `CLUB_ADMIN`: create, import, update, deactivate, reactivate, link, unlink, and adult list succeed through the functions
- Direct insert, update, and delete by that admin: `42501` on all three tables
- Revoked `CLUB_ADMIN`: no visible rows; create `FORBIDDEN`; reactivate and link `NOT_FOUND`
- Other-club `CLUB_ADMIN`: no visible rows for this club; create `FORBIDDEN`; update and link `NOT_FOUND`
- Guardian-only adult, relationship present and membership absent: no visible rows and deactivate `NOT_FOUND`

A future non-admin role cannot be stored. `club_memberships` still allows only `CLUB_ADMIN`. The new select policies also require that role, so a later role would not match them. The passing proofs for “no role” are the outsider and the guardian-only adult.

These results come from `supabase/tests/m1_players_guardians_rls.sql` against the local database, not from mocked clients.

## Audit review

The replaced `audit_events_action_check` keeps `season.created`, `season.updated`, `competition.created`, `competition.updated`, `team.created`, `team.updated`, `venue.created`, and `venue.updated`, and adds:

- `player.created`
- `player.imported`
- `player.updated`
- `player.deactivated`
- `player.reactivated`
- `guardian.linked`
- `guardian.unlinked`

Inserts set `club_id`, `actor_user_id` from `auth.uid()` (or from `assert_club_structure_admin`, which returns that id), `action`, and `target_id`. `created_at` is the table default. The passing create test expects that timestamp to equal transaction `now()`. Target ids are the player id or the relationship id. The audit table has no child-name, email, phone, or metadata column. Idempotent repeats do not write a second row. A trigger that fails the audit insert rolls the player and source rows back.

## Application/web review

`@stable/players` is a vertical slice: domain display policy, application commands, and a Supabase gateway. Generated database types stay in `packages/database-types`. Apps and the platform-neutral domain files are eslint-blocked from importing them. The web server client is the cookie session created with the publishable key.

Commands are `createPlayer`, `importPlayers`, `updatePlayerIdentity`, `deactivatePlayer`, `reactivatePlayer`, `linkGuardian`, and `unlinkGuardian`. Contracts are strict objects and reject auth, contact, team, jersey, role, and preferred-name fields. `PlayerSummary` is id plus display name.

The gateway maps `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, and `VALIDATION_FAILED` onto fixed sentences. Any other driver text becomes `Player changes could not be saved.` or `Players could not be read.` Import row numbers are taken only from a hint that is a list of row numbers.

`/players` is dynamic. A member can list players, add one, import up to 50 structured rows, save a corrected name, deactivate, reactivate, see guardian labels, link from the adult select, and unlink. The registered name is shown on this admin surface. The page has no email field, phone field, adult search, invitation, roster assignment, or team assignment. The nav link and the panel render only when club context status is `member`. The fixture outsider route shows the no-membership state, hides the Players link, and does not render the Players region.

Server actions redirect with an allowlisted sentence. `playerPageError` drops any other query text, including a child name, and appends row numbers only for the import-validation sentence.

## PII leak review

Uses of `firstName`, `lastName`, `first_name`, `last_name`, `registeredPlayerName`, `childDisplayName`, and `playerName` in the slice are the name contract, the admin form fields, the admin page formatters, the import payload the admin submits, and tests. They do not appear in audit writes, product analytics calls, logs, or Sentry calls. The slice adds no `captureException` or `captureProductEvent` call.

`SENSITIVE_METADATA_FIELDS` now includes `firstName`, `lastName`, `first_name`, and `last_name` alongside the existing `playerName`. Exception redaction lowercases keys. Product-event metadata rejects an object that owns one of those exact keys. Both the contracts test and the capture test expect the expanded list.

Redirect query keys are `error` and `rows`. The error value must be one of the fixed player sentences. Row values must be numbers from 1 to 50.

## Test evidence

Commands were run in this review on the existing local Supabase. The local database was not reset.

| Check | Result |
| --- | --- |
| `@stable/players` | 23 passed. Statements, branches, functions, and lines 100%. |
| `@stable/contracts` | 34 passed. 100%. |
| `@stable/permissions` | 8 passed. 100%. `evaluateCapability` still allows only `club.read` for an active club admin. |
| `@stable/current-club-context` unit | 25 passed. 100%. `managedPlayerIds` remains empty. |
| `@stable/web` Vitest for the players panel, player-page errors, and club-admin shell | 12 passed. |
| `eslint .` | Passed. |
| `turbo run typecheck` | 12/12 passed, including web `next typegen`. |
| `@stable/web` production build | Passed. `/players` is dynamic. |
| Fixture Playwright `e2e/players.spec.ts` | 2 passed. Member sees `Alexander Robertson` and `Alexander R.`. Outsider does not see the Players region or link. |
| `pnpm exec supabase test db` | 3 files, 345 tests. **1 failed.** See S13-01. The other 344 assertions passed, including the RLS, link, import, audit-rollback, and anon cases in the player file. |
| Concurrent import of one source id | Second session returned `existing`, kept the original name, and wrote one import audit. |
| `pnpm format:check` | Failed. See S13-02. |

The earlier report of 345 passing tests was not treated as evidence. This run failed test 62, `adult list contains only active members of this club`.

## Repository gates

`pnpm format:check` fails on:

- `apps/mobile/src/auth/auth-screen.test.tsx`
- `apps/mobile/src/auth/auth-screen.tsx`
- `apps/web/components/club-sign-in-live.tsx`
- `apps/web/components/club-sign-in.test.tsx`
- `packages/contracts/src/credential.test.ts`

`git diff slice-1.2 HEAD` is empty for all five. They already fail Prettier at the frozen baseline. Slice 1.3 did not introduce them, and there is no formatting-only commit that repairs them. CI runs `pnpm format:check` before tests, so this gate is red for the branch as it stands. That is not a Slice 1.3 product defect. A freeze should still wait until the gate is green.

Lint, typecheck, the package tests above, and the web production build passed. The local database suite is red for the reason in S13-01. CI resets the local database before `supabase test db` and bootstraps login users afterward, so that job would not see the bootstrapped admin during the test. This review did not reset the database to reproduce that order.

## Findings

### S13-01

- Severity: MEDIUM
- Path/symbol: `supabase/tests/m1_players_guardians_rls.sql`, assertion `adult list contains only active members of this club`
- Behaviour: The test expects `list_club_adults` for club `11111111-1111-4111-8111-111111111111` to return exactly the two fixture user ids inserted inside the test transaction. On this database the first returned id was `22222222-2222-4222-8222-222222222222`, the bootstrapped local club admin.
- Impact: `supabase test db` fails after the documented local bootstrap. The function is doing what it should: listing every active member of that club. This is not a cross-club disclosure. The reported all-pass count is not stable once bootstrap has run. A reset-then-test CI job would not hit this row.
- Evidence: This review’s `pnpm exec supabase test db` reported `Failed test 62` of 136 in `m1_players_guardians_rls.sql`, with have `(22222222-2222-4222-8222-222222222222)` and want `(23232323-2323-4232-8232-232323232323)`. Files=3, Tests=345, Result: FAIL. A separate call as that admin, outside the test, returned only that admin’s user id and `Local Member`.
- Required remediation: Assert that the fixture adults are present and that outsider, other-club, and revoked users are absent, or run the assertion against a club id that seed and bootstrap do not use. Do not weaken the function so that a real club admin disappears from the list.

### S13-02

- Severity: LOW
- Path/symbol: the five files listed under Repository gates
- Behaviour: `prettier --check` fails on those files.
- Impact: The required CI format step is red. The files are unchanged since `slice-1.2`, so this is not a Slice 1.3 behaviour defect. Freeze should not proceed while the gate is red.
- Evidence: `git diff slice-1.2 HEAD` prints nothing for those paths. `pnpm format:check` warns on exactly those five files and exits 1.
- Required remediation: Format those inherited files before the slice is frozen, in a change that does not alter product behaviour.

## Unverified items

- The signed-in Playwright file `apps/web/e2e-auth/players.spec.ts` was read and not re-run. Fixture Playwright covered the member and outsider routes without a live session.
- A clean `supabase db reset` followed by `supabase test db` was not run. Resetting would remove the local login users. The security assertions in that file did pass on the bootstrapped database; the exact adult-list assertion did not.
- The mobile Jest suite was not re-run. No mobile file changed in `slice-1.2..HEAD`.
- A non-`CLUB_ADMIN` membership cannot be inserted under the current role check, so denial of a future role was reviewed from the policy text and from the outsider, revoked-admin, and guardian-only cases.

## Recommendation

PASS WITH CONDITIONS
