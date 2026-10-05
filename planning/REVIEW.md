# Independent Review

## QA — 2026-10-05 / Milestone 0 / 285c956

- Scope: integrated `getCurrentClubContext` proof slice (contracts, permissions, auth, config, observability, feature package, mobile shell, web shell, migrations, pgTAP, CI, EAS). This reviewer did not implement the slice.
- Reviewer: independent QA.
- Database: one existing local stack on `127.0.0.1:54321`. No `supabase start`. No `supabase db reset`. No `supabase test db` (that file inserts the same user ids the bootstrap already created). RLS checks below ran in one transaction and rolled back. Afterwards the member membership was still active and the temporary other club was gone.
- Recommendation: **PASS**

No Critical or High defect. Required authorization behaviour was re-checked on this SHA rather than taken from the integrator log. The browser suite does not sign in the bootstrapped users; that gap is Medium because the same member and outsider sessions were proven through the use case and PostgREST. Milestone 0 CI is not green: the quality job's audit step exits 1.

### Critical

None.

### High

None.

### Medium

1. **Playwright does not sign in the bootstrapped users.** `apps/web/e2e/current-club-context.spec.ts` only opens `/?fixture=member|outsider|unauthenticated`. `playwright.config.ts` forces `NODE_ENV=test` and sets `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to a fake value, so those tests cannot reach local Auth. There is no sign-in control in the web or mobile shell. `loadLiveClubContext`'s signed-in branch, `principalFromSupabase` when `getUser()` returns a user, and `loadMobileCurrentClubContext` have no automated test. A development server on port 3199, using the app's public local env, did return `data-state="unauthenticated"` and ignored `?fixture=member`. The dynamic reader import in that request path succeeded. The signed-in browser and device paths remain unproven.

2. **`expo-doctor` is absent.** `planning/CI_CD.md` and `planning/TESTING.md` list Expo doctor/config validation on pull requests. CI's expo job runs only `expo config --type public`. `expo-doctor` is not a dependency and appears only as a comment in `.github/workflows/ci.yml`.

3. **The quality job cannot succeed.** `pnpm audit --audit-level=high` exits 1. Two high advisories: `node-forge` via Expo's CLI under `@sentry/react-native` / `expo-router`, and `braces` via Metro / Jest under React Native. The audit step has no `continue-on-error`, so the job that also runs format, lint, typecheck, and unit tests is red. The gate was not removed or lowered. This is not a defect in club-context authorization.

### Low

1. **`clubs.active` does not hide a club.** With the member's membership still active, setting the seeded club's `active` flag to false still returned that club to the `authenticated` role. Neither `clubs_select_active_member` nor the Supabase reader filters on `clubs.active`. The flag was restored by rollback. Milestone 0 has no deactivate operation; the column is stored and then ignored on read.

2. **Anonymous deny for profiles and memberships is not in pgTAP.** `supabase/tests/m0_clubs_profiles_memberships_rls.sql` asserts `anon` only against `clubs`. Live checks, as the `anon` role and through PostgREST with the publishable key, returned `42501` for `clubs`, `profiles`, and `club_memberships`. Grants for `anon` and `PUBLIC` are absent; `authenticated` has `SELECT` only.

3. **Maestro is parse-only.** The CI step scans `apps/mobile/maestro/current-club-context.yaml` for `appId`, a document separator, and `launchApp`. It does not run Maestro. Re-running that scanner printed `launchApp,extendedWaitUntil,assertVisible`. The alternation `Mentone Mustangs|No club membership` is not executed, so a flow Maestro would reject can still pass CI.

4. **The database CI job copies extra local secrets into the Vitest process.** After `supabase status -o env`, the job deletes `SUPABASE_SECRET_KEY`, `SECRET_KEY`, and `SERVICE_ROLE_KEY`. This CLI's status keys also include `JWT_SECRET`, `DB_URL`, and `S3_PROTOCOL_ACCESS_KEY_SECRET`, and those stay in the child environment. The integration test does not read them. A dumped environment on failure would leak them. The publishable key on this stack uses the `sb_publishable_` prefix, which the integration test's `sb_secret_` refusal covers. A JWT-shaped service credential would not match that prefix.

5. **The mobile query is not scoped to the user.** `CurrentClubContextScreen` uses the query key `["current-club-context"]`, and the root layout keeps one `QueryClient` for the app lifetime. Nothing subscribes to auth changes or clears that cache. Milestone 0 has no sign-in or account-switch UI, so this does not cross users today. A later session change on the same mounted screen can show the previous club until a refetch finishes.

6. **An empty capability list still renders the club.** `evaluateCapability` is fail-closed, and `getCurrentClubContext` omits `club.read` when the decision is deny. The web and mobile shells still treat a non-null `club` as the member state. The packaged use-case test documents that. The database role check allows only `CLUB_ADMIN`, and the reader schema rejects any other role, so a live session cannot reach "club visible, capability denied" through this reader.

7. **Web auth transport failures look like signed-out.** `principalFromSupabase` ignores the `error` from `getUser()` and returns null when `data.user` is null. The page then asks the visitor to sign in. Data is not shown. An Auth outage is not distinguished from no session.

8. **App shells are outside the coverage gate.** `vitest.shared.ts` thresholds are 95% lines/statements/functions and 90% branches. Exclusions are explicit and limited to tests, `*.generated.ts`, and the declarative `palette.ts` / `scales.ts` maps. Re-running the package tests reported 100% on contracts, permissions, auth, and current-club-context. `apps/web` and `apps/mobile` collect no coverage. `lib/reader.ts` is typechecked and is not the function the page calls; the page uses `createRuntimeClubContextReader`, which did load during the live request.

### Uncertain

The mobile shell's stale query (Low 5) is only reachable once a session can change without remounting the provider. That transition does not exist in this milestone.

### What was verified

| Behaviour | Result |
| --- | --- |
| Active member | Sees only the seeded club, own profile, and own active `CLUB_ADMIN` row. PostgREST returned `mentone-mustangs`, display name `Local Member`, role `CLUB_ADMIN`. Integration Vitest: slug `mentone-mustangs` and `club.read`. |
| Other club | Inserted in the probe transaction. Member count was 0. Rolled back. |
| Outsider | `auth.uid()` set to the outsider. Clubs, profiles, and memberships all 0. PostgREST matched. Integration Vitest: `club` null. Seeded profile name is hidden; auth metadata has no display name, so the reader fallback is `Signed in`. The integration assertion does not check that label. |
| Revoked membership | Same transaction set the member row `active = false`. Clubs, profiles, and memberships all 0 while `auth.uid()` was still the member. Rolled back; row is active again. pgTAP contains the same three empty-select assertions. There is no bootstrapped revoked login, so the HTTP reader was not driven against a revoked session. Empty membership rows are what that reader already maps. |
| Unauthenticated | Use-case tests reject a null principal and do not call the reader. Live Next page: `Authentication is required.` Anonymous SQL role and PostgREST: `42501` on all three tables. |
| Capability fail-closed | Permissions tests: inactive, missing, unknown capability, other club, non-admin role, and an extra `role` field without a membership all deny. An active `CLUB_ADMIN` allows `club.read`. Package coverage 100% branches (7/7). |
| Multiple memberships | Use-case test selects the lexicographically smallest active `clubId` and passes the inactive row through without selecting it. Not inserted in the live database. |
| Reader errors | Use-case and reader unit tests map thrown driver text and PostgREST errors to `Club context could not be read.` without the driver message or `cause`. Re-ran: 25 package tests passed. |
| Apps and database types | No `@stable/database-types` import under `apps/`. ESLint forbids it in apps and in domain/application code. The feature reader is the adapter that imports it. |
| Hidden admin chrome | The link is always `hidden`, including for a member fixture. Outsider and unauthenticated states come from the use case. The live signed-out page contains `admin-chrome-link` and still renders the sign-in state, not the club. |
| CI database job | `.github/workflows/ci.yml` `supabase` job has no `if` and no `continue-on-error`. Order is reset, `supabase test db`, then bootstrap, then the integration Vitest. That avoids the shared user-id collision. The workflow runs on `pull_request` only. |
| Fixture bypass | On the development server, `?fixture=member` did not show Mentone Mustangs. Fixture mode requires `NODE_ENV=test` and refuses `NEXT_PUBLIC_APP_ENV=production`. |

### Test gaps

- Signed-in web cookie session and signed-in mobile `getSession()` path.
- Playwright smoke is presentation-only.
- Maestro is not executed.
- `expo-doctor` is not run.
- pgTAP does not lock anonymous `profiles` / `club_memberships` denial, even though the database currently denies both.
- Integration Vitest does not assert the outsider display name, the exact capability array, or a revoked login.
- Web and mobile coverage is not measured.
- `clubs.active = false` has no regression test.

### Security notes

RLS is forced on all three tables. Authenticated clients can select only. The probe denied anonymous reads, outsider reads, cross-club reads, and revoked reads. The live page HTML contained neither an `sb_publishable_` value nor an `sb_secret_` / `eyJ` token. Reader unit tests keep driver text out of `ApplicationError`. The service-role key is not part of the web or mobile client env schema. Hidden chrome is not the authorization check.

### Commands

| Command | Result |
| --- | --- |
| `pnpm --filter @stable/contracts --filter @stable/permissions --filter @stable/auth --filter @stable/current-club-context test` | Exit 0. Contracts 8, permissions 7, auth 6, current-club-context 25. Coverage 100% on those packages. |
| `pnpm --filter @stable/web test` | Exit 0. 9 tests. |
| `pnpm --filter @stable/mobile test` | Exit 0. 5 tests. |
| Rolled-back `psql` probe in `supabase_db_stable` | Member 1 club / 0 other club; outsider 0; revoked 0; inactive club still visible; `anon` `42501` on all three tables. Rollback confirmed: membership active, other club absent. |
| `vitest run src/infrastructure/supabase-club-context-reader.integration.test.ts` with local URL and publishable key | Exit 0. 2 tests. |
| PostgREST as publishable key, no session, then member and outsider password sign-in | Anonymous `42501` on all three tables. Member: 1 profile, 1 membership, `mentone-mustangs`. Outsider: 0 rows. |
| `next dev --webpack --port 3199`, then GET `/` and `/?fixture=member` | Both HTTP 200, unauthenticated copy, no club name. Server stopped. |
| Maestro line scan from `ci.yml` | Pass. Commands `launchApp,extendedWaitUntil,assertVisible`. |
| `pnpm audit --audit-level=high` | Exit 1. High: `node-forge`, `braces`. |
| `git rev-parse --short HEAD` | `285c956`. |

Not re-run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, full `pnpm test`, web production build, `expo config`, Playwright, `supabase test db`, `supabase db reset`.

## Security — 2026-10-05 / Milestone 0 / 285c956

- Reviewer: independent security. Static review plus `pnpm audit --audit-level=high` (exit 1). Did not edit the repository, start Supabase, or re-run database tests.
- Recommendation: **PASS** for the Milestone 0 trust boundary. No Critical or High findings.
- The audit failure stays a red CI check. It is not a club, profile, or child-data path. Do not lower `--audit-level`.

### Critical

None.

### High

None.

### Low

1. `service_role` grants are `select, insert, update, delete` on `clubs`, `profiles`, and `club_memberships`. Bootstrap only upserts profiles and memberships. The key bypasses RLS and is local/server only.
2. `scripts/bootstrap-local-auth.ts` does not require a loopback URL. Running it against a hosted project would need the secret key and would create the local admin user with the password that is in the script.
3. Anonymous denial is asserted in pgTAP only for `select` on `clubs`. Profile and membership policies still require `user_id = auth.uid()`. A second member is not used to prove one member cannot read another member's profile.
4. Observability drops only exact top-level field names. Nested or renamed sensitive fields would pass. `captureException` does not scrub the error object once a DSN is set. Milestone 0 leaves those DSNs empty.
5. The running apps do not call `parseWebClientEnv` / `parseMobileClientEnv` at boot, so a secret pasted into the publishable variable is not rejected by the schema. The integration test refuses an `sb_secret_` prefix.

### Audit

| Advisory | Package | Where | Milestone 0 trust-boundary blocker |
| --- | --- | --- | --- |
| GHSA-86w9-cpqp-85rv, no patched version | `node-forge@1.4.0` | Expo CLI and code-signing certificates | No |
| GHSA-vfj7-8cjw-p6xm, no patched version | `braces@3.0.3` | Metro file map and Jest | No |

Both become a ship blocker before EAS code signing or a production build. Leave the quality job red until a patched release exists or a human accepts the residual risk.

### Confirmed

- Client schemas reject `SUPABASE_SECRET_KEY`. Mobile and web clients use the publishable key. The web server client is still a user session under RLS.
- EAS preview is `staging` and `https://staging.invalid`. Production has no submit hook. `vercel.json` skips production builds.
- Outsider display name comes from that session's own auth metadata, or `Signed in`. It is not another person's profile row and it does not grant `club.read`.
- The shared local password is not a product login and is not in the env examples.
- No global `user.role`. No players table. Generated database types are imported only by the club-context adapter.
- Child data: no players, media, or roster in this milestone.

### Follow-up after this review

The integrator stopped the CI integration step from copying `supabase status` secrets into the Vitest process. QA Low 4 described the previous step at `285c956`.

## QA — 2026-10-05 / Milestone 0 hardening / 321f521

- Scope: hardening commit `321f521` on `main` (`321f521a412f27251ea8b265d5ede62e3f9fa211`). Boot fail-closed, local auth URL refusal, pgTAP fixture ids, signed-in Playwright, expo-doctor, and the dependency-audit exception. This reviewer did not implement the commit.
- Working tree was clean. No push, no deploy, no `supabase start`, no `supabase db reset`.
- Database: the existing stack on `127.0.0.1:54321` already had the login users. pgTAP was re-run on that database and rolled back. Policy users and the other club were absent afterwards. The login membership `44444444-4444-4444-8444-444444444444` was still active `CLUB_ADMIN`.
- Recommendation: **PASS**

No Critical or High defect. The six required behaviours were re-checked on this SHA. Production release stays blocked by `planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json` and `planning/RELEASE.md`.

### Critical

None.

### High

None.

### Medium

None.

### Low

1. **Patched moderate advisories do not fail the new gate.** `pnpm audit` reports two moderates that already have patched versions: `uuid` `GHSA-w5hq-g745-h8pq` (`>=11.1.1`, via Expo config plugins and `xcode`) and `decode-uri-component` `GHSA-vcc3-ghjq-m6fr` (`>=0.5.0`, via Expo CLI and `query-string`). `evaluateDependencyAudit` skips anything below high. The exception job stays green while those remain. This is outside the two accepted highs. It is still an available upstream fix in the Expo toolchain.

2. **A JWT-shaped publishable key boots when it is not also `SUPABASE_SECRET_KEY`.** `readWebBootEnv` accepted a synthetic `eyJ` service-role-shaped value in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with `SUPABASE_SECRET_KEY` unset. The same value was rejected when it was copied into `SUPABASE_SECRET_KEY`. `sb_secret_` is rejected by prefix even when the secret variable is absent. `loadWebBootEnv` forwards the secret, so the web server shell catches an exact copy. `loadMobileBootEnv` forwards only `EXPO_PUBLIC_*` values, so the mobile shell cannot make that comparison. `readPublicSupabaseConfig` also omits the secret.

3. **The auth Playwright server copies the parent environment through a three-name denylist.** `apps/web/playwright.auth.config.ts` copies every string in `process.env`, then deletes `SUPABASE_SECRET_KEY`, `SECRET_KEY`, and `SERVICE_ROLE_KEY`. The CI wrapper injects only `API_URL` and `PUBLISHABLE_KEY` before that, so the GitHub job does not import `supabase status` secrets. A local shell that already holds `JWT_SECRET` or the storage secret would still pass them into the Next process. This review's run deleted those names before launch.

4. **One accepted advisory can disappear and the job still exits 0.** A copy of the live audit JSON with the `braces` advisory removed still exited 0 because `node-forge` remained. The job fails when the warning list is empty, when an accepted advisory gains `patched_versions`, or when any other high or critical is present. It does not require the live audit to contain every id in the exception file.

### Uncertain

None.

### What was verified

| Behaviour | Result |
| --- | --- |
| Web and mobile boot fail closed | `apps/web/app/layout.tsx`, `apps/web/instrumentation.ts`, and `apps/web/scripts/validate-boot-env.ts` call `loadWebBootEnv`, which calls `readWebBootEnv`. `apps/web/package.json` `build` runs the validator before `next build`. `apps/mobile/app/_layout.tsx` calls `loadMobileBootEnv`, which calls `readMobileBootEnv`. `apps/web/next.config.ts` does not call the parser. A hosted `https://abcd.supabase.co` validator exited 1 with `VALIDATION_FAILED` and did not echo a key. Missing public vars exited 1 naming the three `NEXT_PUBLIC_*` fields. Loopback exited 0. `next dev` on port 3198 with that hosted URL loaded `next.config.ts`, then `instrumentation.ts` threw `Local Supabase URL must not use a supabase.co host` from `readWebBootEnv`. The process did not accept a request (`curl` returned `000`). The server was stopped. Port 3198 was closed afterwards. |
| Bootstrap refuses a hosted project | `resolveConnection` calls `assertLocalDevelopmentSupabaseUrl` before any Admin request. Config tests include a spawn of `scripts/bootstrap-local-auth.ts` with `SUPABASE_URL=https://abcd.supabase.co`. That test passed: non-zero exit, stderr matched the local-tooling refusal, stdout did not contain `bootstrapped`. |
| pgTAP ids | SQL uses policy users `55555555-5555-4555-8555-555555555555` and `66666666-6666-4666-8666-666666666666`, membership `77777777-7777-4777-8777-777777777777`, and emails `policy-member@local.stable.test` / `policy-outsider@local.stable.test`. Login ids `22222222-...` and `33333333-...` appear only in comments. The diff is that id swap. `supabase test db` on the already bootstrapped database: 33 tests, PASS. Rollback held: login users remained, policy users stayed 0, `other-club` stayed 0. pgTAP-then-bootstrap was not re-run, because that needs a reset. Distinct ids plus rollback are what make that order safe. |
| Signed-in browser session | `apps/web/e2e-auth/local-auth-club-context.spec.ts` signs in with `createServerClient`, the publishable key, and the local password, then opens `/`. It does not navigate to `?fixture=`. The auth server sets `NODE_ENV=development`, so fixture mode is off. This run checked the key prefix was `sb_publishable_` and refused to continue otherwise. Member: heading Mentone Mustangs, display name Local Member, `club.read`, `data-state=member`. Outsider: `data-state=no-membership`, no club heading, no `club.read`. 2 passed. Fixture mode would have shown Jordan P / Sam Outsider. Auth metadata has no display name, so the outsider label is `Signed in`. |
| expo-doctor | `expo-doctor@1.20.4` is an `apps/mobile` devDependency. `expo-doctor --version` printed `1.20.4`. `expo-doctor` passed 21/21. `@sentry/react-native` is `~7.11.0` (lockfile `7.11.0`). `apps/mobile/app.config.ts` plugins are `expo-router` only. |
| Audit exception and production block | `pnpm audit` exited 1. High advisories, both with `patched_versions: null`: `node-forge` `GHSA-86w9-cpqp-85rv`, `braces` `GHSA-vfj7-8cjw-p6xm`. Two moderates, listed under Low 1. `scripts/check-dependency-exceptions.ts` on that JSON printed the two residual-risk warnings and exited 0. A copy with an extra critical `left-pad` exited 1. A copy that set node-forge `patched_versions` to `>=9.9.9` exited 1. The exception file `productionStatus` is `BLOCKED`. `planning/RELEASE.md` keeps production Supabase, Vercel production, and EAS production blocked while that field says `BLOCKED`. CI `quality` no longer runs `pnpm audit`. The `dependency-audit` job writes JSON with `\|\| true` and then runs the checker. The checker does not read `productionStatus`; the config unit test locks that field to `BLOCKED`. |

### Test gaps

- Mobile fail-closed was executed through `loadMobileBootEnv` and the root layout call was read. Expo itself was not launched.
- pgTAP after the existing bootstrap was re-run. The clean pgTAP-then-bootstrap order was not, because that needs `supabase db reset`.
- The default Playwright project (`apps/web/e2e`, `NODE_ENV=test`, `?fixture=`) was not re-run. The new auth project was.

### Commands

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `321f521a412f27251ea8b265d5ede62e3f9fa211` on `main`. |
| `pnpm --filter @stable/config test` | Exit 0. 68 tests. Coverage 98.9% statements, 96.24% branches. |
| `pnpm --filter @stable/web test` | Exit 0. 9 tests. |
| `pnpm --filter @stable/mobile test` | Exit 0. 8 tests. |
| `apps/web` `validate-boot-env.ts` with hosted URL, missing vars, and loopback | Exit 1, exit 1, exit 0. Hosted failure did not include a key value. |
| `next dev --webpack --port 3198` with hosted `NEXT_PUBLIC_SUPABASE_URL` | Instrumentation threw `VALIDATION_FAILED` from `readWebBootEnv`. Request was not served. Process stopped. |
| `pnpm --filter @stable/mobile exec expo-doctor` | Exit 0. `21/21 checks passed.` Installed version `1.20.4`. |
| `pnpm audit --json` | Exit 1. High: `node-forge` `GHSA-86w9-cpqp-85rv`, `braces` `GHSA-vfj7-8cjw-p6xm`, both `patched_versions` null. Moderate: `uuid`, `decode-uri-component`, both patched. |
| `scripts/check-dependency-exceptions.ts` on that JSON, then a critical extra, a patched node-forge, and a braces-removed copy | Exit 0, 1, 1, 0. |
| `pnpm exec supabase test db` | Exit 0. 1 file, 33 tests, PASS. CLI is still `2.118.0` and printed an upgrade notice for `2.119.0`. The pin was left unchanged. |
| Auth Playwright `playwright.auth.config.ts` | Exit 0. 2 passed (member and outsider). |
| Direct `readWebBootEnv` / `readMobileBootEnv` with a synthetic JWT | Accepted when the secret variable was absent. Rejected when the publishable value was the secret. |

Node was `24.21.0`. Not re-run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, full `pnpm test`, web production build, `expo config`, the fixture Playwright project, `supabase db reset`, and bootstrap itself against the live stack.

## Security — 2026-10-05 / Milestone 0 hardening / 321f521

- Reviewer: independent security. Static review of `321f521` on `main`. Did not edit the tree, start Supabase, or run the audit. Passing tests elsewhere are evidence, not proof.
- Recommendation: **PASS** for this hardening scope. No Critical or High findings.
- The two accepted highs remain unresolved. Production Supabase, Vercel production, and EAS production stay blocked.

### Critical

None.

### High

None.

### Low

1. The bootstrap URL guard uses the mobile local allowlist, so any RFC1918 host is accepted. A poisoned `SUPABASE_URL` can receive the local service-role key that the script reads from `supabase status`. That is not a hosted-project bypass.
2. The advisory matcher is package name plus advisory id, not the documented Expo CLI or Metro path. The same advisory on a later runtime dependency would still warn and exit 0. The audit script does not read `productionStatus`. The block is the exception file, its unit test, and `planning/RELEASE.md`.
3. The club-context Vitest step in the Supabase job does not delete secret variable names. It also does not copy status secrets into the child, so this is inconsistent hardening rather than a leak in the current workflow.

### Confirmed

- `readWebBootEnv` and `readMobileBootEnv` copy only public keys. `SUPABASE_SECRET_KEY` is compared and is not a field on the result. A public value equal to that secret throws before the result is returned. A publishable value with the `sb_secret_` prefix throws even when the secret is absent.
- `loadWebBootEnv` passes the secret into that check from the root layout, `instrumentation.ts`, and the build script before `next build`. `apps/web/lib/public-supabase-env.ts` does not read `process.env.SUPABASE_SECRET_KEY`. Browser and server Supabase clients both use that reader.
- The mobile shell does not put the secret in the object it validates, so the equality check does not run on device. The `sb_secret_` prefix check does. A legacy JWT-shaped service-role value pasted into the Expo publishable variable would not be rejected there. Current secret keys use the `sb_secret_` prefix, which fails.
- `resolveConnection` calls `assertLocalDevelopmentSupabaseUrl` before Admin user creation and the REST upserts. Hosted `*.supabase.co` is rejected, including a URL with a path. The script upserts `profiles` and `club_memberships` only, plus the Auth Admin create for the two local login users. There is no delete-all helper.
- Policy placeholders are `55555555-5555-4555-8555-555555555555` and `66666666-6666-4666-8666-666666666666`, with membership `77777777-7777-4777-8777-777777777777`. Login users remain `22222222-2222-4222-8222-222222222222` and `33333333-3333-4333-8333-333333333333`. Emails differ. The migration is unchanged. The test still expects the active-membership unique violation (`23505`), the `CLUB_ADMIN` check (`23514`), select-only policies, authenticated write denials (`42501`), outsider and revoked-member empty reads, and anonymous denial. The file still rolls back.
- `apps/web/e2e-auth` signs in with `signInWithPassword` and the publishable key. The session helper and the Playwright server reject an `sb_secret_` value and remove `SUPABASE_SECRET_KEY`, `SECRET_KEY`, and `SERVICE_ROLE_KEY` from the Next process. The spec opens `/` and does not send a fixture query. Fixture mode still requires `NODE_ENV=test`, and this server sets `development`.
- The quality job no longer runs audit. The separate job ignores the raw `pnpm audit` exit code, then fails unless every other high or critical advisory is one of the two accepted ids (`node-forge` `GHSA-86w9-cpqp-85rv`, `braces` `GHSA-vfj7-8cjw-p6xm`) and still has no patched version. Moderate and low stay non-failing, matching the previous `--audit-level=high` threshold. There is no `ignoreGhsas` entry. `planning/RELEASE.md` still blocks production Supabase, Vercel production, and EAS production while the exception file says `productionStatus` is `BLOCKED`.
- The Supabase job runs bootstrap, then the real-auth Playwright project. `supabase status -o env` is captured in the Node process. On failure the step writes a fixed error line and does not write that output. The child environment receives the API URL and publishable key only.
- `@sentry/react-native` moved from `^8.29.0` to `~7.11.0`, and the lockfile resolves `7.11.0`. `app.config.ts` still lists only `expo-router`. Nothing imports `@sentry/react-native` or calls `Sentry.init`. This does not change the trust boundary.

### Files relied on

`packages/config/src/client-env.ts`, `client-env.test.ts`, `supabase-url.ts`, `local-bootstrap-url.test.ts`, `dependency-audit.ts`, `dependency-audit.test.ts`, `apps/web/lib/boot-env.server.ts`, `apps/web/lib/public-supabase-env.ts`, `apps/web/lib/supabase/browser.ts`, `apps/web/lib/supabase/server.ts`, `apps/web/app/layout.tsx`, `apps/web/instrumentation.ts`, `apps/web/scripts/validate-boot-env.ts`, `apps/web/next.config.ts`, `apps/web/package.json`, `apps/web/e2e-auth/local-session.ts`, `apps/web/e2e-auth/local-auth-club-context.spec.ts`, `apps/web/playwright.auth.config.ts`, `apps/web/lib/fixtures.ts`, `apps/mobile/src/boot-env.ts`, `apps/mobile/src/boot-env.test.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/package.json`, `apps/mobile/src/supabase-client.ts`, `scripts/bootstrap-local-auth.ts`, `scripts/check-dependency-exceptions.ts`, `supabase/tests/m0_clubs_profiles_memberships_rls.sql`, `supabase/migrations/20261005120000_create_clubs_profiles_club_memberships.sql`, `.github/workflows/ci.yml`, `planning/RELEASE.md`, `planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json`, `planning/security-exceptions/2026-10-05-expo-metro-high-advisories.md`, `planning/MILESTONE_0_FREEZE.md`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`.

## QA — 2026-10-05 / Milestone 0 finalization / 5fa78c3

- Scope: finalization commit `5fa78c32e16b8ca073d004c982ab03925b63406f` on `main`. Re-checked the four Low findings from `planning/CODEX_M0_REVIEW.md`: privileged bootstrap destination, audit-exception path binding, exception normalization, and anonymous SELECT denial. This reviewer did not implement the commit.
- Working tree was clean at the start. No push, no deploy, no `supabase start`, no `supabase db reset`. Product code was not edited. `planning/CODEX_M0_REVIEW.md` was not edited.
- Database: the existing stack on `127.0.0.1:54321` / `54322`. `supabase test db` ran on that database and rolled back. Afterwards policy users `55555555-5555-4555-8555-555555555555` and `66666666-6666-4666-8666-666666666666` were 0, policy membership `77777777-7777-4777-8777-777777777777` was 0, and login membership `44444444-4444-4444-8444-444444444444` was still active `CLUB_ADMIN`.
- Node was `24.21.0`.
- Recommendation: **PASS**

No Critical, High, or Medium defect. The four Codex lows are closed on the behaviours that were re-run. One residual Low remains in exception-message scrubbing. Production release stays blocked: `productionStatus` is `BLOCKED`.

### Critical

None.

### High

None.

### Medium

None.

### Low

1. **A sensitive literal in `Error.message` is kept when the matching key sits only on a non-enumerable `cause`.** `captureException` still sends a `SafeException` and does not pass the raw `Error`. Enumerable `cause` and `context` values for `email`, `phone`, `token`, `otp`, `playerName`, `privateNote`, and `absenceNote` were absent from the sink payload. `new Error(message, { cause })` stores `cause` as a non-enumerable property, and `collectSensitive` walks `Object.entries`, so it does not see that `cause`. A probe whose message was `failed <privateNote>` and whose `privateNote` lived only on that `cause` forwarded the note inside `message`. `playerName`, present only on the nested `cause`, was not forwarded. Sink keys on the cause were `name`, `classification`, and `message`. No application calls `Sentry.init`, so this does not leave the process today.

### Uncertain

None.

### What was verified

| Behaviour | Result |
| --- | --- |
| M0-LOW-01 bootstrap destination | `assertLocalDevelopmentSupabaseUrl` accepts `localhost`, `127.0.0.1`, and `[::1]`. It rejects `10.0.2.2`, `192.168.1.20`, `172.16.0.4`, `https://abcd.supabase.co`, a `supabase.co` path, `8.8.8.8`, `https://example.com`, `not a url`, and `ftp://127.0.0.1/db` before any Admin call. `resolveLocalBootstrapDestination` returns the status origin, including a trailing slash, and rejects a different loopback port, a non-loopback status URL, and a path, query, or hash. The mobile local allowlist still accepts `http://192.168.1.20:54321` and `http://10.0.2.2:54321`. The privileged check rejects both. |
| Bootstrap script, before Admin API | Spawned `scripts/bootstrap-local-auth.ts` with `SUPABASE_URL` set to `http://192.168.1.20:54321`, `http://10.0.2.2:54321`, `https://abcd.supabase.co`, `https://example.com`, `not a url`, and `http://127.0.0.1:59999`. Each exited 1. Stdout did not contain `bootstrapped`. Stderr did not contain an `sb_secret_` or `eyJ` token. The RFC1918 and emulator URLs failed the loopback refusal. The hosted URL failed the `supabase.co` refusal. The public host failed the public-host refusal. The malformed URL failed as not absolute. The wrong loopback port failed because it does not match the endpoint from `supabase status`. `resolveConnection` throws in that function before `requestJson`. |
| M0-LOW-02 audit exceptions | The exception file `productionStatus` is `BLOCKED`. Accepted ids are `node-forge` `GHSA-86w9-cpqp-85rv` and `braces` `GHSA-vfj7-8cjw-p6xm`, classification `tooling`, with the reviewed path fragments. Live `pnpm audit --json` exited 1 with high 2, critical 0, moderate 2. Both highs have `patched_versions` null. All 140 high-advisory paths matched a reviewed fragment. The checker printed the two residual-risk warnings and exited 0. |
| Audit failures | An injected critical `left-pad` failed as not accepted. Adding `apps__web>node-forge` failed as outside the reviewed tooling path. Deleting the `node-forge` advisory while leaving the high count at 2 failed with `Audit report is incomplete or malformed.` and did not say the advisory was removed. Deleting it and lowering the high count to 1 failed with `node-forge GHSA-86w9-cpqp-85rv is no longer present in the dependency graph.` Passing `productionStatus` `OPEN` failed with the production-stays-blocked failure. The file on disk remains `BLOCKED`. |
| M0-LOW-03 exception sink | With a DSN and sink, the forwarded value was `{ name, classification, message, cause }`, not the same reference and not an `Error`. A fixture with those seven sensitive keys on the error, on `context`, and on a nested `cause` left none of the values in the JSON payload. A throwing sink did not escape `captureException`. A blank DSN does not call the sink. Repository search found no `Sentry.init`. |
| M0-LOW-04 anonymous denial | `supabase/tests/m0_clubs_profiles_memberships_rls.sql` has `select plan(35)` and `42501` assertions for `select` on `clubs`, `profiles`, and `club_memberships` as `anon`. `supabase test db`: 1 file, 35 tests, PASS. Rollback held, as counted above. |

### Commands

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `5fa78c32e16b8ca073d004c982ab03925b63406f` on `main`. |
| `node -v` after `nvm use 24.21.0` | `v24.21.0`. |
| `pnpm --filter @stable/config exec vitest run src/local-bootstrap-url.test.ts src/dependency-audit.test.ts --coverage.enabled=false` | Exit 0. 2 files, 34 tests. |
| `pnpm --filter @stable/observability exec vitest run src/capture.test.ts --coverage.enabled=false` | Exit 0. 1 file, 15 tests. |
| `pnpm audit --json` then `scripts/check-dependency-exceptions.ts` on that file | Audit exit 1. Checker exit 0. Two `::warning::` lines for `node-forge` `GHSA-86w9-cpqp-85rv` and `braces` `GHSA-vfj7-8cjw-p6xm`. |
| Direct `evaluateDependencyAudit` on the live report, then a critical extra, a runtime path, an incomplete drop, a complete drop, and `productionStatus` `OPEN` | Failures empty; then the unaccepted critical; the tooling-path failure; incomplete only; `no longer present`; production-stays-blocked. Live path count 140, unmatched 0. |
| Spawned `scripts/bootstrap-local-auth.ts` for RFC1918, `10.0.2.2`, hosted `supabase.co`, a public host, a malformed URL, and `http://127.0.0.1:59999` | Exit 1 in every case. No `bootstrapped` line. No secret-shaped stderr. |
| `pnpm exec supabase test db` | Exit 0. Files=1, Tests=35, Result: PASS. CLI stayed `2.118.0` and printed an upgrade notice for `2.119.0`. The pin was left unchanged. |
| Rolled-back fixture counts in `supabase_db_stable` | Policy users 0. Policy membership 0. Login membership `true CLUB_ADMIN`. |

Not re-run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, full `pnpm test`, web production build, Expo, Playwright, `supabase db reset`, and a successful bootstrap against the live stack.

### Addendum — f7b417b

- Scope: `f7b417bbb41aa751ff63e90273c3884a135ea238` only. `collectSensitive` now follows `Error.cause` before the parent message is redacted. The new test builds `new Error(message, { cause: { privateNote, playerName } })`.
- The Low finding from this section is closed. The same probe used a non-enumerable `cause` (`enumerable: false`). The sink value was not the raw `Error`. The message was `failed [redacted]`. Neither `coach-only note` nor `Alex Player` appeared in the payload.
- `pnpm --filter @stable/observability test` on Node `24.21.0`: exit 0. 16 tests. Coverage 100% statements, branches, functions, and lines.
- Recommendation: **PASS**

## Security — 2026-10-05 / Milestone 0 finalization / 5fa78c3

- Reviewer: independent security. Static review of `5fa78c32e16b8ca073d004c982ab03925b63406f`, plus focused unit tests (3 files, 49 tests). Did not edit the tree, start Supabase, or run live audit or live pgTAP. Passing tests are evidence, not proof.
- Recommendation: **PASS**. No Critical, High, Medium, Low, or Uncertain findings.
- The four Codex lows are closed on this SHA. Production Supabase, Vercel production, and EAS production stay blocked.

### Critical

None.

### High

None.

### Medium

None.

### Low

None.

### Uncertain

None.

### Confirmed

- `resolveLocalBootstrapDestination` returns only the loopback origin from `supabase status`. A `SUPABASE_URL` is accepted only when it is that same origin. RFC1918, public hosts, `supabase.co`, a different loopback port, and a non-loopback status URL are rejected before any Auth Admin or PostgREST call. The mobile LAN allowlist is not reused. The script still creates the two local Auth users and upserts only `profiles` and `club_memberships`.
- Accepted highs must be classified `tooling` and every reported path must contain a reviewed fragment (`@expo/cli` / code-signing for `node-forge`; Metro and Jest chains for `braces`). Any other high or critical fails. A path outside those fragments fails. An incomplete report fails as incomplete and is not treated as a removed advisory. A complete report that omits a listed advisory fails until the exception file is updated. `productionStatus` is `BLOCKED` in the exception JSON, and `planning/RELEASE.md` still blocks production Supabase, Vercel, and EAS while that status remains. The checker also fails if exceptions exist and the status is anything else.
- `captureException` sends a new `{ name, classification, message, cause? }` value, not the raw error. `email`, `phone`, `token`, `otp`, `playerName`, `privateNote`, and `absenceNote` are not copied, including when nested under `cause` or `context`. String values of those fields are removed from the message, and the same normalization is applied to `cause`. There is no `Sentry.init` and no `@sentry/*` import in application source.
- pgTAP expects SQLSTATE `42501` for anonymous `SELECT` on `clubs`, `profiles`, and `club_memberships`, and the plan count is 35. `supabase/migrations/20261005120000_create_clubs_profiles_club_memberships.sql` is unchanged. `anon` has no `SELECT` grant on those tables.

### Follow-up — f7b417b

- Scope: `f7b417bbb41aa751ff63e90273c3884a135ea238` only. `collectSensitive` follows non-enumerable `Error.cause` before the parent message is redacted.
- M0-LOW-03 remains closed. A `privateNote` or `playerName` that exists only on that cause is removed from the parent message. The extra walk only adds strings to the redaction list. An already-seen cause is not walked twice, and a circular cause still stops. The capture suite passed: 16 tests. There is still no `Sentry.init`.
- No Critical or High finding.
- Recommendation: **PASS**

## QA — 2026-10-06 / Slice 1.1 remediation / 35a8be9

- Scope: remediation on `8f4550d`. Update lookups and the expanded pgTAP matrix. This reviewer did not implement the change.
- Reviewer: independent QA.
- Recommendation: **PASS**. No Critical, High, Medium, Low, or Uncertain findings.
- M1-MED-01 and M1-LOW-01 are closed. Same-club wrong-team denial stays deferred to Slice 1.4.
- Host evidence reviewed, not re-run: `supabase test db` 209 tests PASS, current-club-context integration 2 passed, fixture Playwright 3 passed, real-auth Playwright 4 passed.

## Security — 2026-10-06 / Slice 1.1 remediation / 35a8be9

- Scope: all Slice 1.1 security-definer functions, including the replacement update lookups.
- Reviewer: independent security.
- Recommendation: **PASS**. No Critical, High, Medium, or Low findings.
- M1-LOW-01 is closed: a missing id and another club's id both return `NOT_FOUND`. M1-MED-01 is closed, including the test-only audit rollback. Production Supabase, Vercel production, and EAS production stay blocked.
