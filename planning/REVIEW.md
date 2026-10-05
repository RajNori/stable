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
