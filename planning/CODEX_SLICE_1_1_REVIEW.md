# Slice 1.1 Independent Codex Review

## Reviewed SHA

`8f4550dfc1cd2727f7bc060d358dd07aaf5807d9` on `main`. The checkout was clean before review. The frozen Milestone 0 baseline is tag `milestone-0` at `e6a8397` (`docs: freeze Milestone 0 at the reviewed baseline`). The branch is one commit ahead of `origin/main` with the Slice 1.1 commit under review.

## Review scope

Reviewed the `milestone-0..HEAD` diff (24 files: club structure feature, contracts, generated database types, migration/seed/pgTAP, and web admin UI/tests) plus existing auth, current-club-context, permissions, local Supabase and CI code needed to verify trust boundaries. Read repository/scoped instructions, required planning docs and relevant accepted ADRs: vertical slice architecture, Supabase, contextual capabilities, and explicit reads/commands. No implementation code was changed; no hosted Supabase, Vercel, or EAS service was accessed.

## Commands executed

| Command | Result |
| --- | --- |
| `git rev-parse --show-toplevel` | `/Users/rajnori/Developer/stable` |
| `git branch --show-current` | `main` |
| `git rev-parse HEAD` | `8f4550dfc1cd2727f7bc060d358dd07aaf5807d9` |
| `git status --short --branch` | Clean before review; `main...origin/main [ahead 1]` |
| `git log -12 --oneline --decorate` | Confirmed Slice 1.1 HEAD and frozen `milestone-0` tag at `e6a8397`. |
| `git diff --stat milestone-0..HEAD` | 24 files changed, 4,187 insertions, 3 deletions. |
| `pnpm install --frozen-lockfile` (Node 24.21.0 / pnpm 12.9.1) | Pass; lockfile current. |
| `pnpm format:check` | Pass. |
| `pnpm lint` | Pass. |
| `pnpm typecheck` | Pass; all 11 workspace package typechecks successful. |
| `pnpm test` | Pass; Turbo reported 19 tasks successful. Club-structure: 16 tests; web component tests: 11; mobile: 8. Club-structure unit coverage reported 100% statements, branches, functions, and lines. |
| `pnpm --filter @stable/web build` without env | Expected validation failure for missing `NEXT_PUBLIC_APP_ENV`, Supabase URL and publishable key. |
| `NEXT_PUBLIC_APP_ENV=local NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci pnpm --filter @stable/web build` | Pass; optimized Next.js build completed with `/club-structure` dynamic route. Uses CI-style local placeholders only. |
| `docker info --format '{{.ServerVersion}}'` | Failed: permission denied connecting to the local Docker socket. |

The local database was not reachable through Docker. Therefore `supabase db reset`, pgTAP, local Auth bootstrap, Slice 1.1 reader integration, and real-auth Playwright were not run and are **UNVERIFIED**. No remote/hosted service was used.

## Requirements matrix

| Requirement | Implemented? | Tested? | Evidence | Gap / Risk |
| --- | --- | --- | --- | --- |
| Season, Competition, Venue, Team, AuditEvent slice | Yes | Unit, typecheck, and build pass; DB not run | `packages/features/club-structure`, contracts, migration | Runtime DB behavior remains unverified. |
| Active CLUB_ADMIN creates and updates structure | Yes | Application commands use fakes; pgTAP tests only some database create/update paths | Application `assertClubAdmin`; DB RPCs independently check membership | No authoritative DB tests for all update RPCs; see M1-MED-01. |
| `club.read` unchanged; `activeTeam` remains null | Yes | Source inspected; prior tests in full package suite pass | Slice does not modify the current-club-context capability contract/use case | No change found. |
| Club scoping for rows and references | Yes | Unit checks and source; pgTAP cross-club season rejection is authored but not run | `club_id` on all new tables; composite FKs and RPC checks | Database tests are unverified here. |
| Team cannot reference season/competition/venue from another club | Yes | Application mock tests; pgTAP cross-club season test authored, not run | `teams_*_same_club` composite FKs; `create_club_team` validates all links | Same-club season is explicitly tested in pgTAP; comp/venue cross-club DB cases are not. |
| Active-membership RLS; revoked/outsider/anon deny | Yes in policy definitions | Partial pgTAP source only; database suite not run | Five forced-RLS tables and per-table club membership policies | pgTAP has incomplete active/outsider/revoked coverage for new tables; see M1-MED-01. |
| Direct authenticated writes denied | Yes in grants | Only direct insert on `seasons` is asserted in pgTAP | Migration revokes client table privileges; writes use fixed RPCs | Need DB regression assertions across all tables and write verbs. |
| Audited mutations are trusted and atomic | Yes in RPC design | Some successful audit writes asserted; transaction rollback behavior not exercised | RPCs derive actor with `auth.uid()` and write audit row in the same transaction | Audit assertions omit actor/club/target integrity and failed-operation atomicity. |
| No service-role key in app client | Yes | Static path inspection; web build passes | Gateway receives caller session; server action uses `createSupabaseServerClient`; no service key in feature/app code | Local-auth integration not run. |
| Web admin navigation and create/readback; outsider denied | Yes | Component tests pass; real-auth Playwright source inspected, not run | `apps/web/app/club-structure`, server action, E2E member/outsider cases | Real Supabase path needs local run. |
| No club-management UI added to mobile | Yes | Diff scope inspected | No mobile files changed from Milestone 0. | None. |
| Slice 1.2–1.6 and unrelated features not implemented | Yes | Diff scope inspected | No auth-provider, player, invitation, team-membership, PlayHQ, attendance, notification, duty, Game Day, coaching or practice changes | None. |

## Architecture

The new `@stable/club-structure` package is a behavior-oriented vertical slice with application commands and a Supabase infrastructure gateway. The application package does not import React, Next, or Supabase; web uses a server action and app-local presentation. Contracts are application DTOs, and the gateway maps persistence fields into those DTOs. Generated DB types do not leak into presentation. No generic CRUD framework or speculative shared service was added.

Mutations travel through named RPC operations rather than UI table writes. The web server action uses the request’s user-scoped Supabase server client. It reads the caller session/membership for early application feedback; the SECURITY DEFINER function independently performs authoritative authorization at mutation time. Mobile files and screens are unchanged.

## Contracts

Season, Competition, Venue, Team, AuditEvent, and snapshot schemas are strict application DTOs. Names are trimmed and bounded to 120 characters; entity IDs and ownership relationships are represented in contracts, and update commands do not accept a replacement `clubId`, season ID, competition ID, or venue ID. Updates can change names and active state only. There is no delete path; deactivation is explicit. The DB supplies timestamps, while AuditEvent’s public DTO omits persistence-only `created_at`.

## Authorization

The application command layer requires a non-null principal plus an active `CLUB_ADMIN` membership for the target club. Update commands first load the target’s club through the caller-scoped directory and do not accept caller-selected ownership. The gateway reads session identity via `auth.getUser()` and membership rows through the user-scoped client. Every mutating RPC checks `auth.uid()` and an active `CLUB_ADMIN` membership inside the database function; caller-provided `actorUserId` is not forwarded to the RPC. Create RPCs accept `club_id`, but that value alone grants nothing. Update RPCs derive club from the target row and reauthorize against it. UI navigation is visibility only; direct route/server action and RPC remain guarded by data and DB checks.

## SECURITY DEFINER review

Reviewed all nine SECURITY DEFINER mutation procedures in `supabase/migrations/20261005220000_create_club_structure.sql`: create/update for season, competition, venue and team, plus the combined season-and-team create. Each declares `SET search_path = ''`; table/function references are schema-qualified. Each mutation derives the actor via the internal `assert_club_structure_admin` helper, which reads `auth.uid()` and requires an active `CLUB_ADMIN` membership for the relevant club. The caller cannot pass an actor ID to the SQL functions.

Create competition/team validates referenced rows and club/season relationships. Composite foreign keys independently enforce same-club links for seasons, competitions, and venues. Update procedures do not accept ownership/reference fields. Mutations and audit inserts execute within one PostgreSQL function transaction. The procedures are fixed operations, not arbitrary SQL tunnels. `EXECUTE` is revoked from `PUBLIC`, `anon`, and `authenticated` before being granted to `authenticated`; helper functions are not executable by client roles. Audit writes have no general-purpose exposed function. The functions’ authorization errors are stable codes and the app gateway maps unrecognized driver errors to generic errors.

One cross-tenant information detail remains: update procedures look up an entity by globally unique ID before checking the caller’s membership. They return `NOT_FOUND` for an absent ID and `FORBIDDEN` for an existing ID in another club. Since any authenticated role may execute the fixed RPCs, this distinguishes known target IDs across tenants; see M1-LOW-01.

## Database / RLS

The migration enables and forces RLS on all five tables, revokes direct client table writes, grants authenticated select, and grants service-role table privileges for server administration. Each select policy requires an active membership matching that row’s `club_id`; this also governs audit rows. There is no anonymous table access. Audit events have no authenticated update/delete policy or direct write grant. Tables carry club IDs and composite unique/FK constraints prevent cross-club relations at the database level. All entities have `active`, and update operations soft-deactivate. New tables use the existing `set_updated_at` trigger. No destructive or data-backfill migration was added.

Same-club wrong-team denial is explicitly deferred in the migration and test notes until team membership exists in Slice 1.4; this is appropriate and is not a finding.

## Audit integrity

Every successful create/update RPC inserts an action-specific event with `club_id`, `actor_user_id`, and `target_id`; database `created_at` supplies the timestamp. Actor comes from `auth.uid()`, action values are constrained, and the target is returned by the actual mutation. The event insertion shares the function transaction with its mutation, so an insert error aborts both. Authenticated users can read scoped events but lack direct table write privileges, and no caller-facing audit mutation procedure exists.

## Web

The admin shell shows the Club structure navigation for a resolved member context and hides it for an outsider. The page uses the real current-club context and the user-scoped gateway to list data; it renders a form only when club context exists. The server action validates form field types, obtains the actual session, and calls the combined audited season/team operation. The E2E source signs in a real local member, creates a season/team, and checks readback; its outsider case checks hidden navigation, direct-route denial, and absent form. Those real-auth cases were not executed because local Supabase was unavailable. No generic table writes or browser secrets were found. The UI implements the create flow requested for this slice; update paths exist in the feature/database layer but are not exposed as a web form in this change.

## Test quality

Pinned-runtime format, lint, typecheck, full package tests, and web build passed. The 16 new feature unit tests cover command authorization with active/inactive/other-club memberships, validation and relationship checks, command mapping, and gateway error/mapping behavior. These tests use in-memory directory/writer/client doubles, so they do not prove SQL/RLS behavior. Web component tests cover visible form/navigation states. Authenticated E2E cases are meaningful and use actual local auth by source inspection, but were not run. No skipped or focused tests were found in the new slice tests.

The pgTAP file tests anonymous SELECT denial for each new table, active member reads for seasons and teams, outsider denial for seasons/teams/audit events, revoked member denial for seasons, direct insert denial for seasons, several create procedures, one season deactivation, outsider create denial, one cross-club season reference, and successful audit action/count. It does not exercise direct reads for competitions or venues under an active member, outsider/revoked denies for every table, direct writes for every table, most update RPCs, all RPC EXECUTE grants, exact audit actor/club/target values, or a failing audit insert rollback. Unit mocks do not close these authoritative DB gaps.

## Scope control

The diff contains no implementation of provider expansion, guardian/player relationships, invitations, team membership, registration, PlayHQ, notifications, duties, attendance, Game Day, stats, post-game review, or practice planning. Mobile received no club-management UI. Same-club wrong-team denial is correctly documented as deferred until team membership.

## Findings

### Critical

None.

### High

None.

### Medium

1. **M1-MED-01 — pgTAP does not prove the full Slice 1.1 table/RPC authorization matrix.** Evidence: `supabase/tests/m1_club_structure_rls.sql:103-126,139-157,160-180,205-216,226-250,279-310`. Active reads are not asserted for `competitions` or `venues`; outsider/revoked checks do not cover every table; direct authenticated writes are checked only for seasons; authoritative update coverage is only season deactivation; audit integrity assertions check action/count, not authoritative actor/club/target or failure atomicity. The tests present in `packages/features/club-structure/src/application/club-structure-commands.test.ts` and `.../supabase-club-structure-gateway.test.ts` use fakes and cannot substitute for DB/RLS proof. Impact: policy or function drift on an untested table/operation can ship without the repository’s required RLS allow/deny and audited-command coverage. This falls short of `AGENTS.md` and `planning/TESTING.md` critical gates. Remediation: extend pgTAP with active-member, outsider, revoked, cross-club, and direct-write assertions for each applicable table, exercise every create/update RPC and execute grant, and assert audit actor/club/target plus rollback on a forced audit failure; run the clean local DB sequence.

### Low

1. **M1-LOW-01 — Update RPCs expose cross-club entity existence.** Evidence: the update functions query by ID and raise `NOT_FOUND` before calling `assert_club_structure_admin`, e.g. migration lines 302-308, 366-372, 420-426, and 521-527; `packages/features/club-structure/src/infrastructure/supabase-club-structure-gateway.ts:329-350` maps `NOT_FOUND` and `FORBIDDEN` to distinct client-visible errors. Impact: an authenticated caller able to invoke an update RPC with a candidate UUID can distinguish an absent entity from an existing entity in another club, contrary to the SECURITY DEFINER review requirement not to leak cross-tenant information. UUID entropy limits practical enumeration, so severity is Low. Remediation: return the same external error for absent and unauthorized targets, or authorize through a query that does not reveal cross-club existence before producing the response.

### Uncertain

1. **M1-UNCERTAIN-01 — Database and real-auth end-to-end execution is unverified.** The pinned runtime was available and all runnable code gates passed, but Docker socket access was denied. As a result the requested clean reset, pgTAP, Auth bootstrap, reader integration and real-auth Playwright were not executed. No claim is made that they pass or fail.

## Positive findings

- Repository, branch, clean-tree and frozen-baseline preconditions were satisfied; review scope stayed within Slice 1.1 and its trust boundaries.
- All nine SECURITY DEFINER mutation functions use an empty fixed `search_path`, database-derived actor identity, contextual active-admin authorization, fixed operations, and same-transaction audit insertion.
- Application authorization is reinforced independently at the database mutation boundary; supplied club IDs cannot authorize access on their own.
- Composite foreign keys and function-level checks block cross-club team relationships, and team competition must match its selected season.
- Client table writes are revoked; public/anon RPC execute privileges are explicitly revoked; no service-role key appears in app mutation paths.
- Contracts are strict application DTOs, persistence mapping stays in feature infrastructure, and no generated row types reach UI code.
- The new package meets formatting, lint, typecheck, and unit-test gates; the web production build passes with local-only placeholder configuration.
- Mobile remains unchanged, and no out-of-scope Slice 1.2–1.6 product functionality was added.

## Missing evidence

- `supabase db reset` and `supabase test db` on the pinned CLI/local Docker stack.
- Local Auth bootstrap after clean reset and `@stable/club-structure` reader/command integration against real Supabase.
- Real-auth Playwright member create/readback and outsider direct-route denial.
- Database assertions for all policies/RPCs and audit actor/target/rollback integrity described in M1-MED-01.

## Final recommendation

PASS WITH CONDITIONS

- The app-layer implementation and all runnable pinned-runtime gates pass; no Critical or High implementation defect was found.
- Before advancing the slice, close M1-MED-01 so every new RLS policy and mutation path has authoritative database coverage.
- Resolve or intentionally accept M1-LOW-01 by making absent and cross-tenant update targets indistinguishable to callers.
- Run clean local reset, pgTAP, Auth bootstrap, reader integration and real-auth Playwright when Docker is available; these results remain unverified here.
- Do not treat the missing Docker-backed evidence as a pass.
