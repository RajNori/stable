# Codex Independent Review — Slice 1.3 Player and Guardian Relationships

## Reviewed range

`slice-1.2..HEAD`. `slice-1.2` exists and is an ancestor of `HEAD`. The worktree was clean at review start. `HEAD` includes the Slice 1.3 implementation, QA/security review, S13-01 test remediation, inherited formatting cleanup, and the remediation PASS record. No Slice 1.4 or later implementation is present in the range.

Commits in the range, oldest first:

- `084a5f9b6cc15079d46168f7bfbcc36eb41a9f10` — `feat(players): add child profiles and guardian links`
- `1a3fed3c1a0cab7a5a4b2397a93ce831e6b8f719` — `docs(players): record Slice 1.3 QA and security review`
- `b9666b40405066426d3ad48560cde545cab6f262` — `test(players): harden adult picker membership assertion`
- `6ef6bfe47dd56d55a54cdd9cc34913cc4d80d4ff` — `chore(format): normalize inherited formatting`
- `477b47eb365655c32cc310ba47bc2bfb3899899c` — `docs(players): record Slice 1.3 remediation review`

The complete changed-file list was inspected. It contains the Players slice, its SQL migration and pgTAP suite, Club Admin web surface and tests, generated database types, contracts/observability updates, lockfile/package metadata, QA documentation, and formatting-only changes to inherited auth UI files.

## Reviewed SHA

- Peeled `slice-1.2`: `87affc2724d42b59dc4307ed9271e79bf73a66e7`
- `HEAD`: `477b47eb365655c32cc310ba47bc2bfb3899899c`

## Executive result

**PASS WITH CONDITIONS.** The player/guardian slice meets its tenant, identity, privacy, import, audit, and database authorization requirements. The two prior QA findings are closed and the requested gates pass. One LOW observability hardening issue remains: the product-event PII guard checks only exact top-level keys, so nested child-name fields can pass to the event sink. No current product call site emits product events, so this is not an observed Slice 1.3 data leak. Tighten the guard before introducing nested or extensible player-related event metadata.

## Scope review

The delta implements child player profiles, many-to-many guardian relationships, import identity/idempotency, conservative display-name derivation, and a minimum Club Admin `/players` surface. It does not implement Player authentication, `auth_user_id`, guardian capabilities, team membership, invitations, roster authorization, guardian self-service, PlayHQ, attendance, Game Day, or mobile player-management UI.

`managedPlayerIds` remains `[]`. `evaluateCapability` remains limited to `club.read` for an active `CLUB_ADMIN` membership of the requested club. No role/capability widening is present.

## Player privacy/data model

`public.players` contains only `id`, `club_id`, `first_name`, `last_name`, `active`, `created_at`, and `updated_at`. The player UUID is identity; names are not unique, so duplicate human names are valid. There is no auth-user identity on Player and no date of birth, contact, address, team, medical, or stored display-name field.

Name validation is bounded (1–80 after ASCII-space trimming), rejects ASCII control characters, and does not truncate. The contract’s UTF-16 length rule is stricter than PostgreSQL’s character-count bound for some supplementary-plane strings, not looser. Unicode is preserved; database and contract tests cover non-ASCII names and controls. The masked name is derived at presentation time.

## Display-name policy

`childDisplayName` returns the given name plus the first Unicode grapheme of the surname and a period. The checked cases include Alexander Robertson → Alexander R., Wei L → Wei L., Smith-Jones → S., O'Brien → O., and van der Berg → v. Tests also cover accented, combining, and CJK graphemes. Missing `Intl.Segmenter` fails closed with a fixed error; there is no fallback to the full surname.

`registeredPlayerName` is used only by the Club Admin player-management page (plus fixtures/tests). The guardian/general-facing formatter uses the masked name. A search of changed product call sites found no competing formatter or other screen rebuilding full names.

## Guardian relationship review

`public.guardian_relationships` is a true many-to-many relation: multiple adults can be linked to one Player and one adult can link to siblings. `(player_id, user_id)` is unique; `(player_id, club_id)` is a composite FK to the player’s club; `user_id` references `auth.users` with delete restricted. Links have active/inactive lifecycle and timestamps. Unlink is idempotent; relink reactivates the same row. No `players.guardian_id`, primary guardian, parent-role assumption, relationship label, or `can_manage` field exists.

A guardian row grants no RLS read and no capability. The only table read policy is for an active same-club Club Admin. The guardian-only denial was exercised by pgTAP.

## Tenant isolation

Authorization is enforced in SQL as well as the application layer. The id-based operations lock a player only after matching the caller’s `auth.uid()` to an active Club Admin membership in that player’s club. Missing and cross-club player ids use the same `NOT_FOUND` result. Create/import check the requested club’s admin membership. Guardian linking checks the player’s club and requires the selected adult to be an active member of that same club.

The pgTAP suite passed outsider, revoked admin, other-club admin, guardian-only adult, cross-club id-probe, and direct-write denial cases. UI checks are not treated as authorization proof.

## Adult picker review

`public.list_club_adults(uuid)` requires the caller to be an active `CLUB_ADMIN` of the requested club; a non-admin or other-club request gets `NOT_FOUND`, avoiding directory enumeration. It returns only `user_id` and `display_name` for active memberships in that club. It does not query email, phone, `auth.users`, provider metadata, or a global directory. The UI has a select only; no adult search endpoint exists.

S13-01 changed the pgTAP assertion assumptions, not this function or other product SQL. Its replacement verifies fixture members are present, outsiders/other-club/revoked adults are absent, returned users have active same-club memberships, and the bootstrapped local admin may be present without imposing an exact total. The already-bootstrapped local database now passes the full pgTAP suite.

## Import/idempotency review

`player_source_identities` permits only `club_admin_import`, bounds source ids, and uniquely keys `(club_id, source, source_player_id)`. `import_players` accepts 1–50 rows, validates the complete batch before writes, rejects duplicate source ids within the batch atomically, and does not fuzzy-match names. Different source ids can create distinct players with identical names. Repeating a source id returns the existing player without renaming or duplicate audit. A uniqueness conflict handles concurrent retries. No PlayHQ identity is accepted.

The pgTAP coverage exercises in-batch duplicates, validation rollback, same-id retry, different-id same-name behavior, concurrent retry, and audit failure rollback.

## SECURITY DEFINER review

Reviewed new functions:

| Function | Security/execute boundary |
| --- | --- |
| `public.create_player(uuid, text, text)` | `SECURITY DEFINER`; authenticated execute only; club authorization through `assert_club_structure_admin` |
| `public.import_players(uuid, jsonb)` | `SECURITY DEFINER`; authenticated execute only; club authorization through `assert_club_structure_admin` |
| `public.update_player_identity(uuid, text, text)` | `SECURITY DEFINER`; authenticated execute only; locks/authorizes target player |
| `public.deactivate_player(uuid)` | `SECURITY DEFINER`; authenticated execute only; locks/authorizes target player |
| `public.reactivate_player(uuid)` | `SECURITY DEFINER`; authenticated execute only; locks/authorizes target player |
| `public.link_player_guardian(uuid, uuid)` | `SECURITY DEFINER`; authenticated execute only; authorizes player and same-club active adult |
| `public.unlink_player_guardian(uuid, uuid)` | `SECURITY DEFINER`; authenticated execute only; authorizes player before relationship change |
| `public.list_club_adults(uuid)` | `SECURITY DEFINER`; authenticated execute only; same-club active Club Admin required |
| `public.lock_administered_player(uuid)` | `SECURITY DEFINER` helper; execute revoked from clients; actor is `auth.uid()` |

All privileged functions use `SET search_path = ''`, schema-qualified references, and no caller-supplied actor id. Execute is revoked from `PUBLIC`, `anon`, and `authenticated` before granting authenticated access to the intended operations. `public.player_text(text)` is immutable, not security-definer, and client execution is revoked. The pre-existing `assert_club_structure_admin` remains restricted and is used only for create/import authorization.

## RLS review

RLS is enabled and forced on `players`, `guardian_relationships`, and `player_source_identities`. Authenticated table grants are select-only; there are no direct write policies. `anon` has no table privileges. The policies scope selects to active Club Admin membership in the row’s club. Writes use authorized SQL operations.

The local pgTAP run (not mocked application tests) proved anon, outsider, revoked, other-club, and guardian-only denial; same-club Club Admin select and intended RPC allow; and direct insert/update/delete denial by an authenticated admin.

## Audit review

The migration preserves the existing Slice 1.1 actions (`season.created/updated`, `competition.created/updated`, `team.created/updated`, `venue.created/updated`) and adds `player.created`, `player.imported`, `player.updated`, `player.deactivated`, `player.reactivated`, `guardian.linked`, and `guardian.unlinked`.

Audit rows use the authenticated actor, club, action, target UUID, and database timestamp. Child names and adult contact details are not written. Idempotent no-ops do not duplicate audit rows. pgTAP’s forced audit-insert failure confirms the mutation and audit remain atomic.

## Application/web review

`@stable/players` is a platform-neutral vertical slice with explicit operations, contracts, domain display policy, and a caller-session Supabase gateway. Generated DB types remain in `packages/database-types`. The gateway maps known authorization/validation failures to fixed messages and collapses unknown database text to generic read/save errors.

The dynamic `/players` surface provides create/import/update/deactivate/reactivate and guardian link/unlink for an authorized Club Admin. It has no email/phone search, invitations, roster/team assignment, or guardian self-service. Server-action errors and query parameters are allowlisted; imports expose only validated row numbers. Full registered names are confined to this admin surface.

## PII review

Changed product code uses child names for validation, the authorized admin page, forms, and import payloads. They are absent from SQL audit fields, error messages, URLs/query strings, logs, and current analytics call sites. Sentry exception normalization recursively collects sensitive values and redacts name fields. `SENSITIVE_METADATA_FIELDS` includes camel- and snake-case first/last names.

**Finding S1.3-01 — LOW:** `packages/observability/src/capture.ts`, `isSafeProductMetadata` (around line 200). The product-event guard checks only exact top-level sensitive keys with `Object.hasOwn`. A metadata object with a valid `teamId` plus nested `context: { firstName, last_name }` passes to the sink. I reproduced this with synthetic names; the sink received the nested values unchanged. No current product event call site exists, limiting current exposure, but the newly expanded denylist is not a complete runtime boundary for structured metadata. Before adding player-related or nested product events, reject unknown/nested metadata (prefer a runtime allowlist for the supported flat fields) or recursively reject sensitive keys case-insensitively, and add a nested-field regression test.

## QA remediation verification

S13-01 is closed: the product function semantics are unchanged; the test no longer assumes an exact club-wide adult count; the bootstrapped local database passes 351 pgTAP tests with zero failures. S13-02 is closed: the five formatting files were inherited unchanged from Slice 1.2 until the formatting commit. The patch only changes line wrapping/formatting; calls, conditions, strings, and behavior are unchanged. The repository format gate passes.

## Test evidence

Independently rerun in this review:

- `@stable/players`: 23 tests passed.
- `@stable/contracts`: 34 tests passed.
- `@stable/permissions`: 8 tests passed.
- `@stable/current-club-context` unit suite: 25 tests passed.
- `@stable/web` Vitest: 43 tests passed.
- Fixture Playwright `e2e/players.spec.ts`: 2 passed (Club Admin sees registered and masked names; outsider sees no Players surface).
- Local Supabase `supabase test db`: 3 files, 351 tests, zero failures; no reset was performed.
- Prettier full repository check: passed.
- ESLint full repository check: passed.
- `git diff --check slice-1.2..HEAD`: passed.

The committed remediation review records workspace typecheck 12/12 and web production build passing on the same product tree; these were not rerun in this final review. The full workspace test command and signed-in auth Playwright journey were also not rerun. No claim of independent execution is made for those checks.

## Repository hygiene

The initial worktree was clean. The only test-generated tracked change was Next.js regenerating `apps/web/next-env.d.ts` during the fixture Playwright server startup; it was restored to its committed content. After report creation, the requested review file is the only expected untracked artifact. No env/credential file, test debris, hosted migration, deployment mutation, or unexpected external dependency expansion was found. The package adds only the workspace contracts dependency and Supabase client already used in the repository. Formatting-only changes were manually inspected as line wrapping/formatting with no semantic changes.

## Findings

### S1.3-01 — LOW — Product-event nested PII guard

- **Path/symbol:** `packages/observability/src/capture.ts`, `isSafeProductMetadata` / `captureProductEvent`.
- **Behaviour:** Only exact top-level sensitive keys are rejected; nested or differently cased child-name keys can pass through in an otherwise valid event metadata object.
- **Impact:** A future event caller can accidentally send child names to analytics despite the expanded denylist.
- **Evidence:** A synthetic object containing `teamId` and nested `context.firstName` / `context.last_name` was accepted and forwarded unchanged. There are no current product event call sites.
- **Required remediation:** Enforce a runtime flat-field allowlist or recursively reject sensitive keys independent of case; add a nested PII regression test before adding player-related event metadata.

No Critical, High, or Medium finding was identified in the Slice 1.3 implementation.

## Uncertain/unverified items

Workspace-wide typecheck and production build are recorded as passing on the same product code commit but were not rerun here. The signed-in auth Playwright journey was not rerun. The final review did not reset the local database; the already-running local database was used for pgTAP. These do not leave tenant isolation, RLS, or the tested admin/outsider player journeys unverified.

## Freeze recommendation

**PASS WITH CONDITIONS** — Slice 1.3’s player and guardian behavior is ready to freeze, with one LOW observability hardening item to close before any product-event path accepts nested or extensible player metadata. No Slice 1.4 work or product-code changes were made in this review.
