# Milestone 0 Independent Codex Review

## Reviewed SHA

`e38c4dce0fa22bfed6b4e04c511b373802b2e901` (`main`). Initial repository state was clean (`## main...origin/main [ahead 18]`) and matched the requested SHA. The review stopped short of rerunning stateful local Supabase flows because Docker was unavailable to this execution environment. No implementation files were changed.

## Review scope

Independently inspected the Milestone 0 requirements, accepted ADRs and Cursor guidance, workspace and package boundaries, both app shells, current-club-context path, auth and capability code, migration/RLS/pgTAP sources, environment boot paths, local Auth bootstrap, EAS/Vercel/CI configuration, observability, design tokens, lockfile advisory paths, exception checker, and existing review history for comparison only.

The requested target checkout is `/Users/rajnori/Developer/stable`. This Codex execution was attached to a separate, non-Git workspace. Read-only inspection worked, but the sandbox does not grant writes to the requested checkout.

## Commands executed

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `e38c4dce0fa22bfed6b4e04c511b373802b2e901` |
| `git status --short --branch` | Clean; `main...origin/main [ahead 18]` |
| `git log -20 --oneline --decorate` | Reviewed; requested SHA is current `main` HEAD. |
| `pnpm install --frozen-lockfile` | Exit 255 before install: `[EPERM]` creating `stable/_tmp_...`. The runtime reported Node `v24.19.0` / pnpm `11.19.0`, not the pinned Node `24.21.0` / pnpm `12.9.1`. |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` | Each exited 1 before its task ran, with the same pnpm runtime bootstrap and `[EPERM]` temporary-file failure. |
| `pnpm --filter @stable/web build` | Exit 1 before build, same bootstrap failure. |
| `pnpm --filter @stable/mobile exec expo config --type public`; `expo-doctor`; `pnpm --filter @stable/web exec playwright test` | Each exited 1 before the command ran, same bootstrap failure. |
| `docker info --format '{{.ServerVersion}}'` | Docker API denied access to `~/.docker/run/docker.sock`. |
| `./node_modules/.bin/supabase status -o env` | Could not start: `node: not found` in this execution shell. |
| `pnpm audit --json` | No output after 35 seconds; interrupted. Live audit result was not obtained. |
| Advisory verification | GitHub Advisory Database says both pinned package versions are affected and have no patched version: [node-forge GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). |

The requested reset, pgTAP, bootstrap, reader integration, and real-auth browser runs could not be reproduced because Supabase/Docker was unavailable. No hosted service was accessed. The executable checks above are environment-blocked evidence, not passes or code failures.

## Requirement matrix

| Requirement | Implemented? | Tested? | Evidence | Gap / Risk |
| --- | --- | --- | --- | --- |
| Frozen pnpm/Turbo workspace, strict TypeScript, formatting/lint/test setup | Yes | Not in this run | Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml`, shared Vitest coverage config | Local quality commands did not reach task execution; CI has not run remotely. |
| Feature-oriented package boundaries and current-club-context slice | Yes | Source and test definitions inspected | `packages/features/current-club-context/{src/application,src/infrastructure}`; `packages/contracts`; `packages/database-types` | Full test run unavailable. |
| Authenticated principal and stable context through web and mobile | Yes | Real-auth test definitions inspected; not rerun | Web `loadLiveClubContext` -> `principalFromSupabase` -> runtime reader -> feature use case; mobile `loadMobileCurrentClubContext` -> session principal -> reader -> use case; app routes consume presentation/context | No local live proof this run. |
| Capability matrix (`CLUB_ADMIN` active allows `club.read`; inactive, outsider, unknown deny) | Yes | Implementation and unit test sources inspected; not rerun | `packages/permissions/src/index.ts`; `packages/permissions/src/index.test.ts` | Tests require rerun on pinned runtime. |
| Supabase schema constraints, RLS, select-only policy | Yes | Migration and pgTAP source inspected; DB suite not rerun | `supabase/migrations/20261005120000_create_clubs_profiles_club_memberships.sql`; `supabase/tests/m0_clubs_profiles_memberships_rls.sql` | Anonymous denial assertions cover `clubs`; see low finding for other tables. |
| Deterministic policy fixtures and separate sign-in fixtures | Yes | Source/order reviewed; neither required sequence rerun | PgTAP uses `5555…` / `6666…` ids and rolls back; bootstrap uses `2222…` / `3333…`; freeze defines both orders | Both `reset -> pgTAP -> bootstrap -> reader` and `reset -> bootstrap -> pgTAP` need local reproduction. |
| Supported local Auth fixture creation and scoped bootstrap | Yes | Source and URL guard inspected; not executed | `scripts/bootstrap-local-auth.ts` uses Auth Admin API and upserts only fixture profiles/membership after local URL check | RFC1918 URL acceptance permits a private-network destination under controlled environment poisoning; see Low finding. |
| Fail-closed web/mobile environment boot and no client service key | Yes | Paths and validators inspected; build/runtime validation not rerun | Web layout and instrumentation call `loadWebBootEnv`; web build validates before Next build. Mobile root layout calls `loadMobileBootEnv` before routes/providers. Client readers consume public URL/key only. | Boot checks need execution on pinned runtime; local mobile client itself requires valid public config. |
| Local/staging/production EAS and Vercel separation; no deployment in PR workflow | Yes | Static review | `eas.json`, `apps/web/vercel.json`, `.github/workflows/ci.yml` | No remote Actions/Vercel/EAS execution; production EAS profile requires deployment secrets only when built. |
| Safe observability metadata and no-op when unconfigured | Yes, as an adapter boundary | Unit test sources inspected; not rerun | `packages/contracts/src/observability.ts`; `packages/observability/src/capture.ts` and tests | Exception sink receives raw `unknown` errors when explicitly configured; see Low finding. |
| Semantic token foundation; separate native/web UI | Yes | Source inspected | `packages/design-tokens`; both app shells consume semantic theme values and remain app-local | No visual execution this run. |
| Dependency exception only for accepted advisories; release stays blocked | Yes, with bounded matcher scope | Source, lockfile paths, exception files, and release gate inspected; live audit/checker not run | `node-forge@1.4.0` under Expo CLI/code-signing certificates; `braces@3.0.3` under Metro/micromatch. JSON exception list and `planning/RELEASE.md` mark production blocked. | Tooling runtime paths are not asserted by checker; audit path below. |
| Maestro scaffold and CI pull-request gates | Yes | Static only | `apps/mobile/maestro/current-club-context.yaml`; `.github/workflows/ci.yml` includes quality, DB, web, Expo, Playwright and Maestro parse jobs; no deploy job | GitHub Actions has not run. Local gate was blocked before execution. |

## Architecture

The repository follows the approved Vertical Slice Architecture for the proof capability. The feature use case is platform-neutral and depends on contracts plus the permissions boundary. The Supabase adapter is in feature infrastructure and maps generated database types to the stable contract. The web/mobile presentation and Supabase session wiring are app-local. UI presents the resolved capability and does not grant access based on hidden chrome. Apps do not import generated row types; the feature adapter does. Contracts represent application DTOs, not database row shapes. No domain package with speculative shared services or horizontal god service was found.

The actual read path is present: authenticated Supabase user/session -> `Principal` -> `getCurrentClubContext` -> `evaluateCapability` -> caller-scoped Supabase reader -> RLS -> schema-validated `CurrentClubContext` -> web/mobile presentation. Web verifies the user with `auth.getUser`; mobile reads the persisted session and every data request remains user-scoped and RLS-governed. Service credentials do not enter these adapters.

## Authentication

`User` and `Profile` are represented separately from `Player`; no Player table or player-as-auth-user shortcut exists in Milestone 0. The principal schema has user id and optional display name only; role/provider token fields are dropped. Authorization is not based on profile/auth metadata. The local login fixtures are created by the Auth Admin API in the guarded local script, not seeded as SQL sign-in users; pgTAP placeholder users are separate and transaction-rolled-back. No token/OTP logging path was found in the inspected source.

## Authorization / capabilities

`evaluateCapability` accepts only `club.read`; unknown strings deny. It allows only when a membership matches the requested club, is active, and has role `CLUB_ADMIN`. The use case selects an active membership, uses that club id in the evaluator, and only emits the capability on `allow`. Reader failures and invalid DTOs become stable application errors. UI conditionals are display-only. Current-club queries filter by the principal user id, and RLS independently constrains the rows, preventing a client-supplied user/club id from conferring access.

## Supabase / RLS

The migration enables and forces RLS on all three exposed tables, revokes broad grants from `public`, `anon`, and `authenticated`, then grants authenticated select only. Writes are granted to `service_role` for local fixture setup; no application client uses that key. Club reads require active membership to the club; profile and membership reads are own-user scoped and require active membership. The only function is a fixed `search_path` updated-at trigger function with execute privileges revoked from client roles; no `SECURITY DEFINER` function exists. Constraints include profile E.164 validation, role check, FKs and one active membership per club/user.

The pgTAP source covers active member access, outsider/revoked denial, writes denied for all three tables, and anonymous denial for clubs. The absence of anon probes on profiles and memberships is a small test-completeness gap; the migration’s privilege revokes and lack of anon grants support the intended denial.

## Environment / secrets

The parser is invoked in production-relevant paths: web root layout and Next instrumentation, plus a pre-build validator; mobile invokes its boot parser in the root layout before rendering child routes. Browser/server/mobile Supabase clients use the public publishable key. Web boot compares the public key to a supplied server secret and both public parsers reject `sb_secret_` values. `SUPABASE_SECRET_KEY` is not a client-schema field or returned client config. Invalid env errors do not print key values. EAS preview sets staging; Vercel config skips production builds; CI contains no deployment action.

## Local bootstrap safety

The bootstrap validates its resolved URL before any Auth Admin or REST mutation. Malformed URLs and `supabase.co` hosts fail closed. The script only ensures two Auth users and upserts the intended profile and membership records. It does not manually seed sign-in users in SQL or perform broad deletes. However, the validation intentionally reuses the mobile local allowlist and therefore accepts every RFC1918 IPv4 host, not only loopback or the local Supabase host. A poisoned `SUPABASE_URL` can override the URL while an unset secret is obtained from local `supabase status`; the script then sends that privileged key to the chosen private host. This requires a developer to run the script with a hostile/mistaken environment or destination, so it is bounded local-tooling risk rather than a current remote app exploit.

## Test determinism

The reviewed sources separate pgTAP placeholder ids/emails from login-capable Auth fixture ids/emails. pgTAP runs in a transaction and rolls back; the login bootstrap occurs outside that SQL fixture path. Freeze documentation specifies both orders. Neither requested order was re-executed here, so determinism remains source-supported but unverified in this review.

## Real-auth E2E

The `playwright.auth.config.ts` project signs in with the local Auth API using the publishable key, stores the actual session cookies, and visits `/` without a fixture query. Its member assertions require the seeded club and `club.read`; its outsider assertions require no club and no capability. This uses the actual app reader and RLS by design. The browser tests were not executed here. The web-server config copies the parent environment and deletes three secret variable names; that is narrower than an explicit environment allowlist. No evidence showed a service key in the browser bundle, but the pass-through makes local server-process env minimization less reliable than it should be.

## Privacy / observability

Product event metadata has a small typed allowlist and runtime rejection of the documented sensitive top-level field names; absent PostHog configuration and sink failures are no-ops. No Sentry SDK initialization or `Sentry.init` call exists in the inspected apps, which is appropriate for the current milestone. The exception adapter, if configured with both DSN and sink, forwards the raw `unknown` error unchanged. That is safe while no sink is installed, but a future Sentry integration must scrub exception messages, causes, and attached context before sending.

## Design-system boundary

Only the semantic token/theme foundation is present. The Mustangs palette is mapped into semantic roles and consumed by separate web and native shells. Brand values are centralized rather than scattered across screens. The complete shared component library was not prematurely introduced. Green provides structural identity and gold is used sparingly in the shell.

## Dependency security

The lockfile pins `node-forge@1.4.0` from Expo CLI and `@expo/code-signing-certificates`, and `braces@3.0.3` through `micromatch`; these are tooling paths in the Milestone 0 dependency graph. The current GitHub advisories confirm both remain affected with no patched version. They are accepted residual risks, not remediated vulnerabilities, and both planning exception files keep production release blocked.

The checker examines only high/critical advisories and matches accepted exceptions on package name plus GHSA id, requiring `patched_versions` to be empty. Any other high/critical fails; if no accepted warnings remain it also fails. The exception entries do not constrain the transitive path, so the same package/advisory pair would still be accepted if it later arrived through an application runtime dependency. The checker also does not require every listed advisory to be present in each report; if one disappears while another accepted one remains, the job can still pass. A genuinely removed dependency is safe for that advisory, but a partial/incomplete audit report is not distinguished from genuine absence. This limitation warrants monitoring and is included as a low finding. Live `pnpm audit` and the checker were not run because package-manager bootstrap/network was unavailable.

## CI assessment

Static workflow review shows a frozen-lockfile install, format, lint, typecheck, unit/coverage via package scripts, local Supabase reset/pgTAP/bootstrap/reader integration/auth Playwright, web production build, Expo config/doctor, fixture Playwright, and Maestro flow parsing. CI is pull-request-only and has no deployment job. The dependency audit is an isolated job and keeps production blocked by the release gate. GitHub Actions has not run remotely. Local equivalence could not be established because this shell supplied the wrong Node/pnpm versions and could not access Docker or write pnpm’s temp file.

## Technical debt

Searches found no actionable TODO/FIXME/HACK/bypass markers, explicit `any`, unexplained non-null assertions, or implementation-side `ts-ignore`. `@ts-expect-error` appears in deliberate negative type tests for sensitive analytics metadata. The fixed Mustangs fixture/seed IDs are expected fixture/config values and were not found in capability/domain policy logic. No unexplained swallowed errors or duplicate feature query implementation were identified. The web Playwright environment pass-through and accepted advisory path scope are called out above.

## Findings

### Critical

None.

### High

None.

### Medium

None.

### Low

1. **M0-LOW-01 — Local Auth bootstrap can send a privileged key to any RFC1918 host.** Evidence: `packages/config/src/supabase-url.ts:86-95,126-141` accepts the mobile RFC1918 allowlist for bootstrap; `scripts/bootstrap-local-auth.ts:89-114` lets `SUPABASE_URL` override the status URL while resolving an absent secret from `supabase status`; `scripts/bootstrap-local-auth.ts:139-155` sends the secret in `apikey` and bearer headers to the resolved URL. Impact: a poisoned environment variable or hostile private-network endpoint can receive the local service-role key when the developer invokes the bootstrap. Violates the local-only privileged-credential boundary. Remediation: give bootstrap a dedicated loopback/local endpoint allowlist and reject environment URL overrides that do not identify the configured local Supabase endpoint; retain a deliberate emulator exception only if needed.

2. **M0-LOW-02 — Audit exceptions are not bound to the reviewed dependency paths and do not require every exception to appear.** Evidence: `packages/config/src/dependency-audit.ts:39-77` matches package + advisory id only and accepts success when any accepted warning remains; `.github/workflows/ci.yml` runs that checker on live audit JSON. Impact: the same vulnerable package/advisory can be accepted if it moves into runtime dependencies, and a partial report that omits one advisory can pass while another remains. This is bounded in the present lockfile because both reviewed paths are tooling paths and production is explicitly blocked. Remediation: validate accepted dependency paths or package graph classification, and fail if any expected exception is absent from a successful audit report (while distinguishing a fully removed dependency through an explicit update to the exception file).

3. **M0-LOW-03 — Configured exception reporting forwards unsanitized error objects.** Evidence: `packages/observability/src/capture.ts:48-63` forwards `error` unchanged whenever DSN and sink are configured; planning requires Sentry PII/private-note scrubbing. Impact: a future sink can transmit email, tokens, or private notes embedded in an error/cause/context. No sink or Sentry initialization currently exists, so no current external leak was found. Remediation: add a documented scrub/normalization boundary before connecting a Sentry sink and tests with sensitive error messages/causes.

4. **M0-LOW-04 — Anonymous denial is not directly asserted for every exposed table.** Evidence: `supabase/tests/m0_clubs_profiles_memberships_rls.sql:490-496` probes `anon` only on `clubs`, although the migration revokes anon privileges on all three tables at `:91-97`. Impact: a future grant/policy drift on profiles or memberships could escape the explicit anon regression test. Remediation: add anonymous select denial probes for `profiles` and `club_memberships`.

### Uncertain

1. **M0-UNCERTAIN-01 — The milestone executable gate and both fixture orders remain unverified on this checkout.** The required commands could not reach project tasks because this execution shell exposed Node `24.19.0` / pnpm `11.19.0` rather than the pinned versions and could not create pnpm temp files in the named checkout. Docker socket access was denied. No conclusion can be drawn about current command pass/fail status from this run. Re-run the listed gate on the pinned runtime with local Docker access before freezing Milestone 0.

### Positive findings

- The requested commit and clean-tree precondition were satisfied; no moving target was reviewed.
- Capability evaluation is contextual, active-membership based, and deny-by-default; it is not derived from a global profile role.
- App reads use caller credentials, and the DB independently applies RLS; no client service key path was found.
- RLS is forced and client writes are revoked; constraints encode the limited M0 invariants.
- Login users are provisioned through local Auth APIs, and pgTAP fixtures use distinct rollback-only placeholder identities.
- Environment parsers are called on real app boot/build paths; no Sentry SDK is initialized unexpectedly.
- The two high advisories are documented as residual risks, have no patched version as of this review, and production remains blocked.
- Native and web UI remain separate while consuming shared contracts and semantic tokens.

## Missing evidence

- Pinned-runtime install, formatting, lint, typecheck, full tests and web build.
- Expo public config and Expo Doctor.
- Both clean-reset fixture orders, including pgTAP, Auth bootstrap, and reader integration.
- Member and outsider real-auth Playwright against the local Supabase stack; fixture Playwright smoke.
- Live dependency audit and exception-checker behavior on the current audit report.
- Remote GitHub Actions result.

## Final recommendation

PASS WITH CONDITIONS

- The repository state and source review support the core Milestone 0 trust boundaries; no Critical, High, or Medium code finding was identified.
- Do not treat the prior review’s PASS results as evidence for this SHA’s executable gate.
- Before freezing Milestone 0 or beginning Milestone 1, rerun the full local gate with Node 24.21.0, pnpm 12.9.1, and Docker access, including both fixture orders and real-auth browser tests.
- Keep production Supabase, Vercel, and EAS release blocked while the two accepted highs remain unresolved or explicitly re-accepted.
- Track the four low findings; the RFC1918 bootstrap destination and audit-exception scope deserve the earliest hardening.
