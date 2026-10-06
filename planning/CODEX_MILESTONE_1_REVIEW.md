# Codex Independent Review — Milestone 1 Identity, Tenancy and Roster

## Reviewed range

- Baseline: `slice-1.3` at `0ea03c83efed4073e9baca502064ae8c8c08ae8b`.
- `slice-1.3` exists and is an ancestor of the reviewed HEAD.
- Initial worktree was clean.
- Reviewed commits, oldest first:
  - `1e13643d4ec93ebbc7ddad880093dbd7c1d1a6ba` — `feat(permissions): add contextual team memberships and capabilities`
  - `009f37dd606af544e1d4397aa577bac0b2c843a1` — `feat(invitations): add guardian and staff invitation flows`
  - `e58e7f33742afc3aeb68a00aecc176b8c4eecb78` — `feat(roster): add capability-scoped team roster projections`
  - `6ca43f9d91efbd03ef0748877ee711473aa5a3d9` — `test(web): keep local auth browser tests isolated`
- Diff: 80 changed files, 10,279 insertions and 209 deletions.
- `git diff --check slice-1.3..HEAD` passed.

## Reviewed SHA

`6ca43f9d91efbd03ef0748877ee711473aa5a3d9`

## Executive result

**PASS WITH CONDITIONS.** No Critical or High finding was identified. The database and application enforce contextual authorization, tenant boundaries, verified invitation identity, one-time consumption, and roster masking. One Medium finding remains: the bearer invitation token is placed in the acceptance URL query and stays in the address bar/history while the invitation is pending. The token is identity-bound, which limits the consequence of disclosure, but the URL remains a secret-retention channel.

One Low Unicode consistency finding is recorded. SQL and the domain formatter select different units for complex surname graphemes; the SQL projection still exposes only one code point, so this does not reveal a longer surname.

## Scope

Reviewed all 80 paths in `slice-1.3..HEAD`, including the complete three migrations, generated database contract, capability/context/feature implementations, web and mobile routes, UI components, tests, and Playwright configuration. Read the root and scoped agent instructions, the requested planning documents, and accepted ADRs 0001–0013. Used Slice 1.3 as the frozen behavior baseline.

The diff contains no fixtures, schedule, attendance, training, offline Game Day, or other Milestone 2 implementation. The only changed Playwright configuration serializes the local authenticated suite. Supabase status reported an unlinked project and a local API at loopback; no hosted infrastructure was modified or contacted.

## Authorization model

There is no global user/profile role or auth-metadata role. Club Admin remains in `club_memberships`; Head Coach, Assistant Coach, and Team Manager are rows in `team_memberships`; guardian access is a separate relationship combined with active player registration. The capability evaluator derives grants from these facts and unions active grants. Revoking one team role does not erase another role, a guardian relationship, or Club Admin membership.

The accepted V1 architecture is one club with many teams. Team context is explicit: one eligible team becomes `activeTeam`; zero or multiple teams produce `null`, with eligible teams listed in `availableTeams`. The mobile roster screen stops with “Use a context with one team” if there is not exactly one active team. It does not select the first team or issue a roster request in that case. Available team names derive only from the caller’s active staff facts or complete guardian-registration chain. A future multi-club user context has no selector yet; the current context resolver deterministically uses the lowest eligible club UUID. V1 documents one club, so this is recorded as a scope limitation rather than a present tenant leak.

## Club Admin

Admin functions check the authenticated actor’s active Club Admin row in the target club inside SQL. Team lookup and same-club membership checks bind the operation to the target tenant. A Club Admin does not gain authority in another club, and staff roles do not satisfy admin checks. Direct authenticated writes to membership and registration tables are revoked. The pgTAP suite covers same-club, other-club, revoked, outsider, and anonymous cases.

## Team staff

Staff roles are team-scoped and constrained to the three supported values. Roster read and full-name access require an active team plus an active membership in that exact team, or an active Club Admin in the team’s club. A role on another team or club is insufficient. The capability matrix gives Team Managers roster management and denies them coach check-in; coaches receive coach check-in but not roster management. Multiple roles are independent active facts and are unioned. Revocation updates only the specified role; idempotent revocation does not add a duplicate audit event.

## Guardian authorization

The capability evaluator requires active guardian relationship, active player, active registration, active team, and matching club/team/player context. SQL roster access independently checks the same guardian-to-player-to-registration-to-team chain. Guardians can read their registered team’s masked roster, while player management capabilities remain scoped to their own managed player IDs. Siblings are collected independently; an unrelated child on the same team does not gain guardian management access. Inactive links, registrations, players, and teams fail closed.

## Player-team registration

Composite foreign keys bind both team and player to the registration’s club. A partial unique index enforces at most one active registration per player; unique (team, player) preserves a historical row for reactivation. Registration locks the player row before checking/updating its active registration, so competing moves serialize; the unique index is an additional invariant. Club Admin can move a player between active teams in the same club. Team Manager can register on their own team, can repeat the same registration idempotently, and cannot move or unregister a player registered on another team. Coaches cannot mutate registrations. Registration/unregistration writes and audit entries share a transaction. Inactive teams/players cannot be newly registered.

## Current context

Context facts are read through the caller’s Supabase client under RLS; no service-role key is used and child names are not selected. The domain resolver filters inactive facts, does not choose a first team, and returns `activeTeam: null` when team selection would be ambiguous. `managedPlayerIds` requires the complete active guardian/player/registration/team chain and is deduplicated and sorted. The capability set unions relevant active paths for the selected club. The mobile one-team limit fails closed as described above.

## Invitation security

The invitation table has forced RLS and no authenticated or anonymous table privileges; only the privileged RPC implementation can read or mutate it. Creation requires an active Club Admin in the same club and checks target shape, tenant, active player/team, and exactly one identity. Tokens use 32 cryptographically random bytes; only SHA-256 digest is stored. The raw token is returned from creation only so the link can be delivered. Audit rows contain action, actor, club, and target ID only.

Acceptance requires a signed-in actor and a verified matching email or phone from `auth.users`, not unverified metadata. Email is trimmed/lowercased when stored and lowercased for comparison; phone whitespace is removed on both sides. Mismatch uses a generic identity error and does not reveal the intended address/number. Guardian invitations create/reactivate only a guardian relationship; staff invitations create/reactivate only the invited team role. Acceptance rechecks active target state. Revoke and expiry are enforced in SQL; invitations do not themselves confer capability. Existing active links/roles do not get duplicate link/assignment audit rows, and consumed token replay is rejected.

Admin listing returns the identity and target data the admin entered for that admin’s club. It does not return `token_hash` or raw token. Invitation IDs alone do not expose records. Malformed tokens return NOT_FOUND. Expired, revoked, and consumed states are distinguishable only to a signed-in caller holding the high-entropy token.

## Invitation concurrency

`accept_invitation` selects the digest-matched invitation `FOR UPDATE`, then checks consumed/revoked/expiry, verifies identity, performs the relationship or membership upsert, marks the invitation consumed, and writes audit events before the function transaction commits. A concurrent second transaction waits on that row; under PostgreSQL READ COMMITTED it rechecks the updated row and sees `consumed_at`, then errors before changing memberships or audit. Under stronger snapshot isolation it can instead fail serialization. In either case the source ordering admits at most one successful acceptance. The unique relationship/membership keys additionally prevent duplicate grants.

A genuinely simultaneous two-session acceptance was not run. The SQL lock/transaction proof supports a single winner; runtime scheduling behavior remains empirically unverified. Sequential replay is covered by pgTAP and authenticated browser tests. This is not a finding.

## Invitation identity

The identity invariant is an XOR check in both the app command and the database. Email and phone acceptance require their corresponding `auth.users` confirmed timestamp, and comparisons use normalized stored values. Credentials changed to an unverified address/number cannot consume an invite. The verified matching identity is necessary even if an attacker obtains a token. The database acceptance response contains invitation type and scoped target IDs, not intended contact data.

## Roster authorization

The database exposes only the masked or full roster RPCs; guardians and staff have no direct SELECT on player names. Both functions filter to active registrations and active players on the requested active team. The authorization helper checks active Club Admin, active staff membership in that team, or the full guardian chain for masked access. Guardians cannot request the full projection. Staff and Club Admin full-name access is scoped to the requested active team/club. The app selects full or masked RPC based on capabilities, but SQL repeats the authorization, so UI checks are not the enforcement boundary.

Roster mutations use the same SQL manager/admin checks and current facts are only an application-side early check. A stale UI or guessed player/team IDs do not bypass the RPC checks.

## Roster privacy

Guardian projections return player ID, team ID, and first name plus one surname code point; no child contact fields, guardian contact fields, private notes, or unrelated identifiers are projected. Staff full names and Club Admin registered names are returned only through the full RPC after its SQL check. The UI uses only the server projection and does not fetch all player rows and hide fields client-side.

## Unicode masking consistency

The source difference is real. SQL `substring(text from 1 for 1)` returns one PostgreSQL character (one Unicode code point); the domain `childDisplayName` uses `Intl.Segmenter` at grapheme granularity. A local read-only PostgreSQL probe for decomposed `e + U+0301` returned hex `65` for the mask and `65cc81` for the full grapheme. Emoji ZWJ sequences can differ similarly. The SQL projection does not expose the combining mark or the rest of the surname, so there is no extra surname disclosure. The resulting guardian display can differ from the domain formatter (for example, `e.` versus `é.`), which can be visually inconsistent for names beginning with combining sequences.

## RLS

Reviewed every policy added or replaced in the membership/registration migration and the table grants/policies for invitations. The 490 pgTAP assertions cover anonymous and outsider denial, same-club admin access, cross-club and revoked-admin denial, staff own/other-team behavior across roles, guardian-owned/unrelated/other-team behavior, multi-role access, revoked staff, direct-write denial, and roster projection privacy. Policy helpers return booleans only and do not grant row access by themselves. Authenticated table writes are revoked for trusted membership/registration/invitation mutations.

## SECURITY DEFINER

Reviewed every new privileged function. Each sets an empty search path, schema-qualifies database objects and helper calls, derives actor from `auth.uid()`, performs authorization inside SQL, and is revoked from PUBLIC/anon. Operation RPCs are granted to authenticated callers as intended; internal roster/admin helpers are not directly executable by authenticated callers.

Functions reviewed: `player_is_active`, `team_is_active`, `caller_guards_player`, `assign_team_role`, `revoke_team_role`, `reactivate_team_role`, `register_player_on_team` (final definition in the roster migration), `unregister_player_from_team` (final definition in the roster migration), `caller_is_club_admin`, `caller_manages_team`, `assert_team_roster_reader`, `list_team_roster_masked`, `list_team_roster_full`, `create_invitation`, `list_club_invitations`, `revoke_invitation`, and `accept_invitation`.

## Audit

New audit actions are constrained to the intended membership, registration, and invitation actions. Mutations and audit writes occur in the same SQL transaction. Audit records contain actor ID, club ID, target ID, action, and database-generated timestamp; they do not include names, email, phone, raw token, digest, or arbitrary metadata. Repeated no-op role revocation/assignment and already-active guardian/staff links do not duplicate the grant-specific audit. Replaying a consumed invitation fails before writing audit.

## Application boundaries

The feature packages expose explicit operations and validated contracts rather than database rows. Supabase adapters map recognized SQL error codes to stable application messages and map unknown provider errors to generic failures. Server actions do not return raw PostgREST errors. Web and mobile roster reads call the projection RPC. No app authorization check replaces the SQL boundary. No invitation token is sent to analytics or explicit application logging in the reviewed paths.

## Observability / PII

The Slice 1.3 metadata guard remains intact: supported metadata is flat string-only, keys are allowlisted, unknown/nested/array values are rejected, and key matching handles sensitive case variants. No new analytics capture was added in this diff. Search of the new invitation, membership, and roster paths found no child name, contact, invitation token, or hash added to analytics, Sentry metadata, application logs, or audit payloads. The invitation acceptance query-string retention finding below is separate from analytics capture.

## Playwright isolation

The gate fix sets `workers: 1` and keeps `fullyParallel: false`; it changes test scheduling, not product behavior. The local authenticated tests share seeded member/outsider accounts and mutate state (for example, creating players), so serialization is consistent with test isolation. The prior three parallel-failure artifacts were not present in the repository, so their exact traces could not be independently inspected. The serial rerun passed all 12 tests, including invitations and roster. This is test-isolation debt, not evidence of a product concurrency/session defect.

## Database reproducibility

Local Supabase status showed the project was unlinked and the API URL was loopback. `supabase db reset` rebuilt the database from the full migration chain and seed successfully. pgTAP passed after reset, then the documented local Auth bootstrap completed, and pgTAP passed again with the bootstrap users present. No hosted Supabase migration or infrastructure action occurred.

## Test evidence

**RERUN**

- `pnpm format:check` — PASS.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS (15 tasks).
- Focused tests: permissions 17; current-club-context 32; invitations 7; roster 12; observability 19 — PASS.
- Mobile Jest — PASS, 59 tests.
- Web unit/component suite — PASS, 51 tests.
- Current-club-context local integration — PASS, 2 tests.
- Authenticated local Playwright — PASS, 12 tests, 1 worker.
- `supabase db reset` — PASS, local only.
- `supabase test db` immediately after reset — PASS, 6 files / 490 tests.
- Local Auth bootstrap — PASS.
- `supabase test db` after bootstrap — PASS, 6 files / 490 tests.
- `git diff --check slice-1.3..HEAD` — PASS.

**SOURCE REVIEW**

- Invitation concurrency ordering, identity checks, RLS, helper grants, audit atomicity, roster SQL projections, app error mapping, metadata filtering, and the one-active-registration invariant were reviewed directly.
- Unicode behavior was checked by a read-only query on local PostgreSQL.
- Hosted Supabase/Vercel/EAS state was not accessed.

**REPORTED ONLY / NOT RERUN**

- Expo public config and Expo Doctor checks.
- The implementation’s reported full application test gate beyond the focused packages, mobile Jest, web unit suite, and authenticated Playwright listed above.
- A truly simultaneous two-session invitation acceptance test.

The configured Node runtime was 24.19.0 while the workspace declares 24.21.0; all commands above completed successfully despite the engine warning. Web build output loaded the repository’s existing `.env.local`; no values were printed or changed.

## Adversarial scenarios

- Revoked role removes only that role; team and club authorization queries require active rows at mutation/read time.
- An inactive team or player blocks new registration/invitation acceptance; roster helpers deny inactive teams and projections filter inactive players/registrations.
- Guardian relationship revocation or registration removal makes the full chain false for subsequent SQL reads.
- A role revoked after UI load is rechecked by the mutation RPC.
- Three simultaneous roles remain independent rows; team membership facts union by context.
- Sibling player IDs are independently derived; unrelated players on the same team do not gain guardian management.
- Same invite concurrent acceptance is serialized by row lock; sequential consumed replay fails.
- Existing active guardian/staff grants are not duplicated; inactive matching grants are reactivated under the verified invitation.
- Guessed invitation IDs cannot enumerate the table; malformed token fails as NOT_FOUND; cross-club target IDs fail the same-club checks/composite constraints.
- Concurrent registration moves serialize on the player row and are backed by the partial unique index.

## Repository hygiene

The checkout was clean before review. No product code was changed, no commit was created, and no push or tag was made. The only requested output is this review report. The worktree is clean apart from the report file.

## Findings

### M1-MED-01 — Raw invitation token persists in the acceptance URL

- **Severity:** MEDIUM
- **Path/symbol:** `apps/web/components/invitation-panel.tsx:77-79`; `apps/web/app/invitations/accept/page.tsx:16-29`
- **Concrete behaviour:** Creation returns a bearer token to the browser, which builds `/invitations/accept?token=<raw token>`. The server page reads it from `searchParams` and renders it into a hidden POST field. Until the user accepts or leaves the page, the full token remains in the address bar and browser history; the initial HTTP request necessarily carries it in the URL.
- **Impact:** Browser history, copied URLs, and request/access-log retention can preserve the raw invitation secret. Possession alone is insufficient because acceptance also requires a verified identity match, and tokens are high entropy and one-use, which limits but does not remove this exposure.
- **Evidence:** The URL is assembled at `invitation-panel.tsx:77-79`; the token is read from the query and copied into the form at `accept/page.tsx:16-29`. No token-query redaction or immediate URL scrubbing is configured in the reviewed app.
- **Required remediation:** Before freeze, keep the raw token out of the HTTP query and retained browser history, or implement equivalent verified controls: deliver via a fragment/client handoff followed by POST, scrub the URL immediately, and ensure request/access logs never retain token values. Preserve the identity binding and one-time database check.

### M1-LOW-01 — SQL mask and domain formatter disagree for grapheme initials

- **Severity:** LOW
- **Path/symbol:** `supabase/migrations/20261006180000_create_roster_projections.sql:126-129`; `packages/features/players/src/domain/child-display-name.ts:98-100`
- **Concrete behaviour:** SQL takes one Unicode code point from the surname; the domain formatter takes the first Unicode grapheme. Decomposed accents and multi-code-point emoji graphemes therefore yield different guardian display strings.
- **Impact:** Guardian-facing identity presentation can differ from the domain formatter. The SQL result still withholds the rest of the surname and does not expose additional child data.
- **Evidence:** PostgreSQL returned `65` for the initial of decomposed `e + U+0301`, while the complete grapheme encoded as `65cc81`; the domain uses `Intl.Segmenter`.
- **Required remediation:** Use a database-compatible grapheme-aware mask or establish one shared normalization/initial rule and test combining marks, non-Latin text, supplementary-plane characters, and emoji sequences.

## Unverified items

- Two simultaneous sessions were not run against the same invitation. Source analysis establishes a single winner through row locking and transactional consumption, but live concurrent scheduling was not empirically verified.
- The exact three failures from the first parallel Playwright run were not retained in repository evidence.
- Hosted infrastructure was intentionally not accessed.
- Multi-club selection is not implemented in this V1 current-context contract; V1 documentation defines one club with many teams.

## Freeze recommendation

**PASS WITH CONDITIONS**

No Critical or High finding remains. Resolve M1-MED-01 by preventing raw invitation tokens from persisting in request URLs/browser history or by adding verified equivalent redaction and scrubbing controls before freeze. M1-LOW-01 is a known display-consistency issue with no demonstrated increase in surname disclosure and may be tracked as Low.

# M1-MED-01 Remediation Delta

## Reviewed range

- Baseline: `6ca43f9d91efbd03ef0748877ee711473aa5a3d9`.
- Review/documentation commit: `c190534f28088cedcab533d804baa816ad65ba3b`.
- Remediation commit and current HEAD: `6d98f905f2273f0ee86a1d43edb5fd18064da72d`.
- Baseline is an ancestor; initial worktree was clean.
- The 12-file delta consists of invitation acceptance URL/page/client handoff, related unit and Playwright coverage, and this review documentation. No Milestone 2 implementation exists. No hosted service was accessed.

## Token transport

Generated links use `/invitations/accept#<64-lowercase-hex-token>`. The URL helper stores the token in the fragment, so the initial HTTP request target omits it. The server page does not use a query token as acceptance state. If a `token` query key is present, it redirects to the clean acceptance route (preserving only an allowlisted result message); it never copies that query value into the client component or POST form. The fragment parser requires exactly 64 lowercase hexadecimal characters.

## URL/history behavior

The client handoff reads `window.location.hash` in `useLayoutEffect` and immediately calls `history.replaceState` with a URL that has neither fragment nor token query. The resulting visible URL is `/invitations/accept` (or that path plus a safe result query). A `hashchange` listener handles fragments added or changed after the page is open. Malformed fragments are scrubbed and display the not-found message.

Playwright captured request URLs and acceptance-page response URLs/HTML. For valid generated links, it observed no raw token in the initial request URL, response URL, response HTML, or post-scrub visible URL. The raw token appears in the server-action POST body only when the acceptance form is submitted.

A hard reload after scrubbing starts with a fresh JavaScript realm and fails closed; the E2E test verifies this. SPA unmount/remount behavior is different and has the retention issue described under Secret retention.

## Secret retention

No remediation code writes the token to localStorage, sessionStorage, cookies, analytics, Sentry, console, application logging, audit metadata, or a new database field. The existing server action passes the submitted value to the acceptance RPC, which hashes it for lookup; migration, database type, and invitation action files are unchanged in this delta. No application request logger that records POST bodies was found.

**Residual defect:** `accept-invitation-handoff.tsx:12, 27-45` stores the token in the module-level `retainedFragmentToken`. This variable survives component unmounts and client-side navigation in the same tab/runtime. If the handoff is later mounted at `/invitations/accept` with no fragment, `takeFragmentToken` returns that cached token and reconstructs an acceptance form. It also outlives the component that ostensibly owns the transient token. The hard-reload test passes because a full reload discards the module, but it does not test SPA navigation. This is more persistence than transient component memory and means missing-fragment does not always fail closed within the same runtime.

The test-only `resetInvitationHandoffMemory` helper is not called by application navigation or unmount cleanup. The token is also placed in the rendered hidden input after handoff; this is expected for the eventual POST, but combined with the module cache it remains available after navigating away and back.

## Authorization regression

The delta does not change invitation SQL, migrations, database types, feature commands/gateway, or server actions. Source comparison confirms the token generation remains 32 random bytes, the database stores only the SHA-256 digest, and verified email/phone identity matching, expiry, revocation, one-time consumption, `FOR UPDATE`, guardian/staff grant creation/reactivation, and audit behavior are unchanged. Invitation table RLS and grants are unchanged. Thus the remediation reduces request-URL exposure without changing database authorization semantics; the cached token cannot bypass the verified-identity or consumed-state checks.

## Test evidence

**RERUN**

- `pnpm --filter @stable/web test` — PASS, 12 files / 65 tests.
- `pnpm format:check` — PASS.
- `pnpm lint` — PASS.
- `git diff --check 6ca43f9d91efbd03ef0748877ee711473aa5a3d9..HEAD` — PASS.
- Focused authenticated Playwright, invitation and roster specs — PASS, 3 tests (guardian accept/identity mismatch/replay, missing/malformed/query token handling, and masked/full roster flow).
- Local `supabase test db` — PASS, 6 files / 490 assertions; the invitation RLS file passed.

**SOURCE REVIEW**

- Generated link helper, fragment parser, scrub logic, page query redirect, handoff state lifetime, server-action boundary, and E2E request/response assertions were reviewed.
- No token logging middleware or request-body logger was found in the web application.
- Authorization and invitation SQL are unchanged in the delta.

The workspace requested Node 24.21.0; the available runtime was 24.19.0. Rerun commands completed successfully with the workspace engine warning.

## M1-MED-01 status

**OPEN**

The original query-string exposure is closed for generated links and malicious query values are redirected without rendering or submitting them. URL scrubbing and initial-request behavior pass. The finding remains open because the module-level cache survives component unmount/navigation and can restore a token on a later no-fragment visit. The acceptance authorization checks remain intact, but the stated transient-only retention condition is not met.

To close this finding, retain the token only in the mounted handoff instance (state/ref that supports React effect replay), clear it on real unmount or completion, and verify client-side navigation away/back with no fragment fails closed. Keep the existing request-target, history, and post-body assertions.

## M1-LOW-01 disposition

**ACCEPTED LOW TECHNICAL DEBT.** This remediation does not change SQL masking or the domain grapheme formatter. The prior finding remains a presentation inconsistency without demonstrated additional surname disclosure and is not reopened.

## Final freeze recommendation

**PASS WITH CONDITIONS**

The URL transport portion is verified and the authorization model is unchanged. Keep Milestone 1 freeze conditional on removing module-scoped token retention and adding an SPA unmount/navigation regression check. M1-LOW-01 remains accepted Low technical debt.

# M1-MED-01 Final Remediation Delta

## Reviewed range

- Final remediation baseline: `6d98f905f2273f0ee86a1d43edb5fd18064da72d`.
- Remediation commit: `33987b99450799f35573564b7ab972bc297783e2`.
- Current HEAD: `518c793368ae5a9898df7a618ae37580c0440dcb`, a documentation-only commit after the remediation.
- The baseline is an ancestor of HEAD; the worktree was clean at review start.
- Commits in the delta: `33987b99450799f35573564b7ab972bc297783e2` (token lifetime hardening), followed by `518c793368ae5a9898df7a618ae37580c0440dcb` (review documentation).
- Product delta is limited to the invitation handoff and its tests. No Milestone 2 files changed. No tag points to the remediation; no remote-tracking branch containing it is present in this checkout. No push, tag, or hosted infrastructure operation was performed during this review.

## Component-local token lifetime

The module-level `retainedFragmentToken` and `resetInvitationHandoffMemory` are removed. There is no replacement singleton, context, provider, global, or window token cache in the acceptance handoff. The token is held in a `useRef` and React state owned by the mounted `AcceptInvitationHandoff` instance. The hidden input is rendered only after the client reads the token; it submits that token with the acceptance server action when the user submits the form.

A new instance at `/invitations/accept` with no fragment starts with an undefined ref, reads no token, sets null, and renders the not-found message without an acceptance button. A real unmount destroys the instance ref/state. The unit unmount/remount test and same-runtime Playwright navigation test both verify the old token is not recovered.

No token is written to pathname, query, retained fragment, localStorage, sessionStorage, cookies, or navigation history state. The creator’s invitation panel still holds the generated copyable link in component state while it is displayed; this is the intended one-time delivery surface and is not browser storage.

## Strict Mode behavior

On the first effect setup, the mounted instance captures the fragment into its ref before scrubbing the URL, then copies it into local state. React development Strict Mode can replay the effect setup/cleanup for the same mounted instance; the ref remains populated, so the replay does not need the scrubbed fragment and acceptance remains available. A new component instance receives a new empty ref and cannot recover that value. The explicit React `StrictMode` component test passes.

## SPA navigation proof

The component test captures a valid fragment, unmounts the handoff, and mounts a new handoff with no fragment; it displays the not-found message and no acceptance button. A separate component test toggles away from and back to the handoff.

The authenticated Playwright test creates an invitation, captures and scrubs its fragment, records a marker on `window`, navigates away with the Next client router, and navigates back to `/invitations/accept` without a fragment. The marker confirms the browser JavaScript runtime survived the navigation. The new page fails closed, contains no acceptance button, and contains no token in its URL or HTML. This directly covers the prior module-cache behavior.

## URL/request safety

Generated links continue to use `/invitations/accept#<token>`; no generated link uses `?token=`. The fragment is client-only and absent from the initial HTTP request target. `useLayoutEffect` captures it and calls `history.replaceState`; the visible URL becomes `/invitations/accept`. The server page redirects any supplied `token` query to the clean acceptance route and never passes that query value into the handoff.

The focused browser coverage verifies initial request/response URLs and acceptance-page HTML omit the token, and that the POST body carries it only on form submission. Malformed and missing fragments show not-found and fail closed; malformed fragments are scrubbed. A crafted `?token=` is redirected without copying the token into the redirect, rendered page, or acceptance state. Hard reload after scrub fails closed. Hash changes are read and scrubbed by the listener.

## Secret retention

The remediation contains no localStorage, sessionStorage, cookie, analytics, Sentry, console, or application logging write for the raw acceptance token. The Playwright request watcher observes URLs and POST data and confirms the token occurs in the POST body only when acceptance is submitted, not in request URLs. No request-body logging middleware was introduced or found. Audit behavior is unchanged and does not receive the raw token. Database migration and schema files are unchanged; only the existing SHA-256 digest is stored.

## Authorization regression

The product delta does not change invitation SQL, migrations, database types, feature commands/gateway, or server actions. The final remediation is limited to browser token lifetime and related tests. The prior authorization invariants therefore remain unchanged: 32 cryptographically random bytes, SHA-256 digest-only persistence, verified email/phone match, expiry, revocation, one-time consumption, `FOR UPDATE` serialization, guardian relationship creation/reactivation, team staff membership creation/reactivation, forced invitation RLS, same-club target scoping, and transactional audit behavior.

## Test evidence

**RERUN**

- `pnpm --filter @stable/web test` — PASS, 12 files / 67 tests.
- `pnpm format:check` — PASS.
- `pnpm lint` — PASS.
- `git diff --check 6d98f905f2273f0ee86a1d43edb5fd18064da72d..HEAD` and worktree diff check — PASS.
- Focused authenticated invitation/roster Playwright — PASS, 4 tests, including Strict Mode unit coverage, one-time/identity-bound acceptance, missing/malformed/query token failure, same-runtime client navigation away/back, and roster regression.
- Local `supabase test db` — PASS, 6 files / 490 assertions; invitation RLS file passed.

**SOURCE REVIEW**

- Confirmed no module-scope token variable or test reset export remains; token state/ref is instantiated inside the mounted component.
- Traced Strict Mode effect replay and real unmount/remount behavior.
- Reviewed the unit and Playwright regressions for SPA navigation in the same JavaScript runtime.
- Compared the delta against the previous invitation SQL and server-action behavior; those files are unchanged.

**REPORTED ONLY**

- Typecheck, full workspace tests, and web production build were reported as passing for the final remediation but were not rerun in this delta review.

The available Node runtime was 24.19.0 while the workspace declares 24.21.0. Rerun checks completed successfully with the engine warning. The local pgTAP suite was run against the already-running local Supabase stack; no hosted service was accessed.

## M1-MED-01 final status

**CLOSED**

The query-string exposure remains fixed, the fragment is scrubbed, and the token now belongs only to the mounted handoff instance. A fresh mount and an SPA return in the same runtime cannot recover it. Strict Mode effect replay preserves the token for the same instance, while a real unmount destroys it. Acceptance authorization semantics remain unchanged.

## M1-LOW-01 disposition

**ACCEPTED LOW TECHNICAL DEBT.** Roster masking did not change in this remediation. The known one-code-point SQL versus one-grapheme domain display difference remains a presentation inconsistency without demonstrated additional surname disclosure and is not a Milestone 1 freeze blocker.

## Milestone 1 final freeze recommendation

**PASS**

M1-MED-01 is closed based on source review and passing focused unit, browser, and database regression checks. M1-LOW-01 remains accepted Low technical debt.
