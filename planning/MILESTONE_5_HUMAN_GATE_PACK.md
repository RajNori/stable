# Milestone 5 — Human Gate Closure Pack

This pack prepares the remaining pilot operations. It is not evidence that any
external gate passed. Use synthetic identities and data until the pilot owner
approves otherwise. PR #3 remains Draft; no hosted mutation, production action,
public store submission, or Sentry event is authorized by this document.

## 1. Sentry staging verification

### Current state

- `@sentry/nextjs` is declared by `apps/web`; `@sentry/react-native` is declared
  by `apps/mobile`. The shared `@stable/observability` package is a no-op without
  both a configured DSN and an installed exception sink. Neither runtime calls
  `Sentry.init`, installs an SDK sink, nor sends an event today.
- `NEXT_PUBLIC_SENTRY_DSN` (web) and `EXPO_PUBLIC_SENTRY_DSN` (mobile) are
  already optional configuration names. They are blank in the example files.
  A DSN is a public ingest destination, not an authentication secret, but its
  owner/project still requires approval.
- Shared normalization forwards only a fixed exception shape: constant message,
  fixed name, bounded classification, and bounded cause chain. It omits stack,
  arbitrary properties, request data and user identity. Existing
  `@stable/observability` tests pass 19/19 and exercise child-name, private-note,
  email, phone, OTP, token, arbitrary context, and nested/circular error cases.
  These tests verify the shared normalized helper only; they do not prove a
  future Sentry SDK event processor or actual external event payload.
- No runtime wiring was added: SDK initialization could create network telemetry
  once an error/session occurs. Stop before that boundary until the owner
  approves the exact staging Sentry organization, project, and DSN destination.

### Wiring contract to use only after destination approval

- Keep Sentry disabled when the optional DSN is absent. Do not provide any
  default DSN or reuse production DSNs in local/Preview/staging.
- Map `local`, `staging`, and `production` from the existing
  `NEXT_PUBLIC_APP_ENV` / `EXPO_PUBLIC_APP_ENV` values. Release identity should
  be derived from the immutable candidate git SHA plus the app version (for
  example, `stable-web@<version>+<sha>` and `stable-mobile@<version>+<sha>`),
  not from a mutable branch name. Record those exact labels in the run evidence.
- Before installing the transport, normalize through the existing shared
  helper. The SDK adapter's event-processor/before-send boundary must construct
  an allowlisted event from that normalized value and drop all other fields.
  Explicitly disable user identification, default PII, request-body capture,
  breadcrumbs carrying routes/forms, attachments, replay/session replay,
  profiling, and automatic navigation/network breadcrumbs. Do not call
  `setUser`, attach child/team names, include raw URLs, or capture arbitrary
  metadata. A rejected/throwing scrubber must drop the event.
- New adapter tests must feed synthetic exceptions containing child names,
  `STAFF_PRIVATE` notes, email, phone, OTP, access/refresh tokens, request body,
  headers, URL/query, and arbitrary context. Assert the serialized SDK event
  contains only the explicit allowlist; assert absent DSN sends nothing.
  Confirm the received synthetic event in the approved Sentry project and
  inspect its full payload before calling the gate PASS.
- Keep source maps private: upload maps only to the approved Sentry project
  during the CI/EAS build, keep the upload token server-side, and ensure maps
  are not served as public assets. Verify a known synthetic stack resolves to
  the reviewed source location without exposing the map URL publicly. No
  source-map upload token or Sentry project identity is present in this repo.

### Exact environment names and owner action

- Web public runtime: `NEXT_PUBLIC_SENTRY_DSN`.
- Mobile public runtime: `EXPO_PUBLIC_SENTRY_DSN`.
- Build-time source-map upload, if approved: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  and `SENTRY_PROJECT` in protected build/EAS configuration. The auth token is
  secret; org/project slugs are identifiers. Never prefix the token with
  `NEXT_PUBLIC_` / `EXPO_PUBLIC_` or store it in git.
- Mobile source-map/symbol upload: configure the approved Sentry project/plugin
  and upload credential in the protected EAS environment only after owner
  approval. Do not assume the web token or project is appropriate for mobile.

Owner checklist: approve the exact non-production Sentry org/project and DSN;
confirm protected build-secret handling; approve runtime wiring; install staging
values; run the synthetic event procedure; inspect tags and complete event
payload; verify scrub behavior and symbol/source-map resolution. No event is sent
before this approval.

## 2. Hosted staging Supabase verification

### Repository evidence and identity boundary

- `supabase/config.toml` has `project_id = "stable"`, which is only the local
  CLI project name. It does not identify a hosted project.
- This checkout contains no approved staging or production project reference
  and no hosted database URL. EAS `preview` selects app mode `staging`; its
  hosted Supabase URL and publishable key are configured outside git. Vercel
  Preview's staging mapping is user-confirmed, but it does not identify the
  EAS staging project or establish backup/retention status.
- Never print, commit, or paste DB passwords, service-role keys, access tokens,
  DSNs, or signing credentials into this evidence.

### Owner-operated, read-only verification

1. In Supabase Dashboard, use the project selector and open the intended
   **staging** project. Go to **Project Settings → General**; record the project
   name, organization, region, and project reference in the approved release
   system. Open the separately identified production project and compare its
   project reference. Stop if either reference is unknown, matches unexpectedly,
   or ownership/environment labels are ambiguous.
2. In **Project Settings → API** (or the current API settings page), compare the
   project URL with the `preview` EAS environment's `EXPO_PUBLIC_SUPABASE_URL`
   and Vercel Preview's `NEXT_PUBLIC_SUPABASE_URL`. Confirm the public key is a
   publishable/anon key, the app mode is `staging`, and there are no loopback or
   production values. Do not copy secret keys into the app environment.
3. In **Authentication → URL Configuration**, verify staging Site URL and
   redirect allowlist contain the approved web callback and `stable://auth/callback`
   as applicable, with no production-only or wildcard redirect. Inspect enabled
   sign-in providers, email OTP/template/expiry/rate settings, phone/SMS
   configuration, SMTP sender, and test-user policy. Record pass/fail and
   non-secret values only.
4. In **Database → Migrations** (or SQL Editor), compare applied migration
   versions with the repository's sorted `supabase/migrations` filenames.
   If using SQL Editor, the read-only query is:

   ```sql
   select version
   from supabase_migrations.schema_migrations
   order by version;
   ```

   Do not run `db push`, `migration repair`, SQL mutations, or `supabase link`
   as part of this identity/verification pass. Escalate missing or unexpected
   versions for review.
5. In **Database → Backups** and, if configured, **Point in Time**, record the
   plan, backup schedule, oldest/newest available recovery point, and configured
   retention window. Do not press Restore. Supabase database backups do not
   contain the Storage API's object bytes; see the platform backup and storage
   documentation linked below.
6. In **Storage → Buckets**, record bucket names, public/private flags, size and
   MIME constraints, and object counts only. Confirm current app buckets remain
   private unless specifically approved. Ask the storage owner where object
   bytes are independently backed up, retention/versions, who can restore them,
   and how object bytes and DB metadata are reconciled. Database restore alone
   cannot recover deleted object bytes.
7. Safest recovery rehearsal: create/use a separate disposable staging project
   and restore a chosen backup there. Do not overwrite the active staging
   project. Reapply/verify Auth settings, redirect URLs, keys, functions,
   Storage buckets/policies and objects, then run migration/RLS and synthetic
   critical-journey checks. In-place restore requires a separate explicit
   approval naming project ref, restore point, expected downtime/data loss,
   storage plan, and rollback plan. No destructive restore is authorized here.

**Exact owner input needed:** project references and names for staging and
production (not credentials), access to the staging dashboard, EAS `preview`
environment membership, and a storage/backup owner response describing object
recovery. If CLI access is preferred, install the pinned Supabase CLI, authenticate
as an authorized read-only/project member, then use `supabase projects list`
for identification only; do not link or mutate a project.

## 3. iOS TestFlight and Android Internal Testing

### Repository audit

- `apps/mobile/app.config.ts`: scheme `stable`; bundle identifier and Android
  application ID are both `app.stable.mobile`; app version is `0.0.0`; no
  explicit iOS build number or Android version code is set. These identifiers
  and version values are unverified against Apple/Google account records.
- Existing EAS `preview` is `distribution: internal`, environment `preview`,
  and `EXPO_PUBLIC_APP_ENV=staging`. That produces direct internal-distribution
  artifacts; it is not a TestFlight upload profile and is not a Play Store AAB.
- EAS `testflight` and `play-internal` build profiles are prepared. Both select
  the EAS `preview` environment and force app mode `staging`; both use store
  distribution. Android explicitly builds an app bundle. The repository's
  `packages/config/src/eas.test.ts` deliberately rejects any `submit` block, so
  none is configured. For Play, the account owner must upload the exact AAB
  manually under Play Console **Testing → Internal testing**, save as Draft, and
  verify the track before proceeding. No EAS build, signing, submission, or store
  action was run.
- No OAuth, push, universal-link or app-link credentials are configured here.
  Auth callback scheme is `stable://auth/callback`. Notifications/push
  provider state is not externally verified.

### Before build: account-owner checks

- Confirm `app.stable.mobile` is the approved app record in both App Store
  Connect and Google Play Console; confirm team/account ownership and bundle ID
  / package match. Do not create a duplicate app record.
- Choose/approve the first pilot marketing version and ensure a unique iOS
  build number and Android version code. Current local app version `0.0.0`,
  absent explicit build numbers, and EAS `appVersionSource: local` require this
  check; do not invent a release version or overwrite an existing store version.
- In Expo Dashboard, confirm the EAS `preview` environment contains the
  positively identified staging `EXPO_PUBLIC_SUPABASE_URL` and publishable key,
  and no service-role secret. Check `eas whoami` and project association locally
  without printing environment values. Confirm the account owner approves EAS
  signing-credential creation/reuse and the resulting devices/account access.
- Confirm the pilot privacy disclosures and store privacy/data-safety answers
  describe actual auth/contact and operational data flows. Do not make a public
  listing or store release.

### Exact owner-run commands after approval

From the reviewed candidate checkout, with the approved EAS project/account
selected and `preview` environment already verified:

```sh
eas build --platform ios --profile testflight
# Record EAS build ID, app version/build number, candidate SHA, staging env,
# signing credential identity (non-secret label only), and artifact status.
eas submit --platform ios --id <that-ios-build-id>
# This uploads to App Store Connect/TestFlight processing, not App Store review.
```

```sh
eas build --platform android --profile play-internal
# Record EAS build ID, app version/versionCode, candidate SHA, staging env,
# signing key identity (non-secret label only), and AAB artifact status.
# Account owner downloads the AAB for <that-android-build-id> from EAS, verifies
# its candidate SHA, then opens Play Console → Testing → Internal testing →
# Create new release, uploads this AAB, verifies Internal track, and saves Draft.
# Do not invoke eas submit: this repo deliberately has no submit profile/hook.
```

Stop before each EAS command until the account owner explicitly authorizes the
build/signing operation. Stop before `eas submit` until that owner approves upload
to the named TestFlight app or Play Console Internal track. Never use a production
build profile, `--auto-submit`, App Store review submission, EAS Submit for
Android, or Play Production, Open, or Closed track for this pilot gate. After
iOS upload, the owner must complete TestFlight internal tester/group setup. After
Android upload, the owner must verify the release remains a draft on Internal
track, then complete tester setup. Record exact store build ID plus candidate
SHA for both platforms.

## 4. Physical-device accessibility script (15–20 minutes)

Use a synthetic test account and a staging/test build only. Record device model,
OS version, build ID/SHA, result, and a short issue description; do not record
real child names or contact details.

### iOS / VoiceOver (7–9 minutes)

1. **Sign-in/callback (2 min):** Settings → Accessibility → VoiceOver On; open
   Stable, swipe through email/phone sign-in, OTP entry, validation error, and
   “Completing sign-in” callback state using the approved synthetic account.
   **Pass:** each field/control has a useful label, role and state; focus advances
   in visual order; callback pending is announced; success reaches the signed-in
   home without focus stuck behind the auth gate; validation/recovery message is
   announced once and is actionable.
2. **Game Day and stale/offline state (3 min):** authenticated coach → schedule
   → choose synthetic fixture → Game Day. Turn on Airplane Mode, reopen/refresh
   Game Day, inspect the stale indicator, then restore connectivity.
   **Pass:** heading/score/stat controls and labels are announced in order;
   offline/stale state is announced with timestamp where shown; stale values are
   clearly read-only; no RSVP/stat write appears successful offline; refreshed
   authoritative content replaces the stale view after connectivity returns.
3. **Roster/action targets (1 min):** coach → team roster and Game Day controls;
   use VoiceOver gestures to reach each visible action and activate one safe
   navigation/control action.
   **Pass:** no unlabeled icon-only controls, focus is not trapped, and controls
   are independently reachable/activatable.
4. **Large text and target size (2–3 min):** Settings → Accessibility → Display &
   Text Size → Larger Text (maximum practical size); return to Game Day and
   roster. Tap key sign-in, navigation, and Game Day controls.
   **Pass:** text remains readable without overlap/clipping hiding meaning or
   controls; scrolling exposes content; interactive targets can be hit without
   adjacent accidental activation. Record any layout/target issue.

### Android / TalkBack (7–9 minutes)

1. **Sign-in/callback (2 min):** Settings → Accessibility → TalkBack On; repeat
   email/phone sign-in, OTP validation, and pending callback path.
   **Pass:** labels/roles/states and focus order match visible order; callback
   pending and recovery/error state are announced; focus lands on signed-in home.
2. **Game Day and stale/offline (3 min):** repeat iOS Game Day path and network
   toggle.
   **Pass:** Game Day labels/actions and stale/read-only status are announced;
   stale data cannot be mistaken for a successful write; fresh server data
   replaces stale state after network returns.
3. **Roster/action targets (1 min):** visit roster and Game Day controls with
   TalkBack navigation.
   **Pass:** every visible interactive item is labeled, focusable, and operable;
   no focus trap or obscured action.
4. **Large font/display and targets (2–3 min):** Settings → Display → Display
   size and text → largest practical setting; inspect same screens and touch
   controls.
   **Pass:** no critical text/action is clipped or overlapping; content can be
   scrolled; targets can be activated independently without unintended adjacent
   actions.

**Record:** PASS/FAIL per numbered item; exact build SHA/ID and OS; issues with
screen/path and observed vs expected behavior. A failure on a critical auth or
Game Day path is a pilot blocker pending fix and repeat device check.

## 5. Synthetic first-team operator rehearsal

### Safety and setup

- Run against a unique disposable **local** Supabase project only. Never connect
  the rehearsal to staging or production. Use invented adult/child labels such
  as `Coach Alpha`, `Guardian Alpha`, `Player Alpha`; use only local test email
  values and no real contact details.
- Existing local rehearsal evidence is the critical E2E matrix in
  `MILESTONE_5_RELEASE_EVIDENCE.md`: guardian invitation → synthetic player/team
  → Game Day → RSVP; coach stats → post-game review → next-practice focus/planner;
  Club Admin team/staff/guardian; manager fixture/duty/announcement/fill-in;
  cross-team denial. These tests passed at product/test SHA
  `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb` (authenticated Playwright 24/24;
  pgTAP 23/917). This is automated synthetic workflow evidence, not a live
  operator usability rehearsal.

### Human-readable rehearsal run card

Use a clean local reset and follow `planning/TESTING.md` and `planning/RELEASE.md`
for the disposable local stack; if Docker access fails, stop without changing
containers and record the limitation. Open the local web app and complete in
order, recording PASS/FAIL, the page/action used, and ambiguity:

| Step | Operator action | Expected evidence / stop condition |
|---|---|---|
| 1 | Create/select synthetic club and season in Club Structure. | Club and season appear in the correct active context. If authority or creation path is unclear, stop and record exact label/page. |
| 2 | Create competition, venue, and a synthetic team; attach team to season/competition. | Team fixture/schedule context points to the chosen season and venue. No app-specific ID or code change. |
| 3 | Assign Coach Alpha as active HEAD_COACH and a second synthetic adult as ASSISTANT_COACH; create a separate TEAM_MANAGER only if needed for the role-boundary case. | Both coaches can access exact-team M4 features. Manager cannot access M4 coaching data. Revoke coach after optional denial check; access must disappear. |
| 4 | Create a guardian invitation using local test delivery; accept it as Guardian Alpha. | One-time identity-bound invitation succeeds; callback uses local URL/scheme. Never send real email/SMS. |
| 5 | Create/register Player Alpha to the team and link the guardian. | Guardian sees only linked player; coach sees team roster. Do not enter real child details. |
| 6 | Add one recurring synthetic training occurrence. | Team/date/venue correct; attendance/check-in path available. |
| 7 | Create one manual fixture with synthetic opponent/date/venue. | Fixture is scoped to team; Stable/manual result fields remain separate from imported/provider fields. |
| 8 | As guardian, submit RSVP; as manager/coach, inspect roster. | RSVP is visible to authorized team staff; another team cannot see it. |
| 9 | Assign a duty, publish a synthetic announcement, and create/fill a fill-in request. | Correct team and audience; no cross-team disclosure; notification delivery remains local/test-only. |
| 10 | As coach, open Game Day, enter bounded synthetic score/player stats, and save. | Game Day values persist; unauthorized role/team denial remains intact. |
| 11 | Complete post-game team review and record next-practice focus/planner item. | Review and next practice plan are visible only to authorized coaches. |
| 12 | As guardian and TEAM_MANAGER, attempt relevant coaching views; as a Team B coach try Team A IDs if two teams exist. | M4 stats/history/review/private-note/practice data denied; ordinary fixture projection remains as designed. Stop and report any unexpected access. |
| 13 | Remove the active coach membership and retry M4 read/write; then sign out. | Revoked coach loses M4 access immediately. Test/local synthetic data is reset only after evidence is recorded. |

**Automated vs human:** items exercised by prior critical E2E/pgTAP are evidence
that code paths work under automation. They do not establish that an unfamiliar
operator can discover the correct menu, resolve ambiguity, or safely operate a
real club. A human operator must run the run card once on the local disposable
system and report step outcomes/ambiguities before this gate is PASS.

## 6. Exact PR/CI evidence and disposition

- Product/code/test and independent-review SHA remains
  `3dbed1557d73afee4e95f28eeb4cc4ad12b76fbb` for the prior reviewed product
  candidate.
- GitHub's externally verified 8/8 result (`quality`, `dependency-audit`,
  `supabase`, `web-build`, `expo`, `playwright`, `playwright-auth`, `maestro`)
  was on PR head `6adc49acb6ea62ff0c9a04601b19ab7b09d0a124`.
- GitHub read-only verification confirmed PR #3 remains OPEN and Draft at
  gate-preparation SHA `0eb162b2df8f094245e038f58f043e050e668fd0`; all eight
  required jobs passed on that same exact SHA: `quality`, `dependency-audit`,
  `supabase`, `web-build`, `expo`, `playwright`, `playwright-auth`, and
  `maestro`. Vercel Preview also passed; Supabase Preview was skipped and is not
  required.
- The evidence-only successor commit is separate from the product-code,
  independent-review, and gate-preparation SHAs. Do not make another commit
  solely to record CI for a new documentation-only SHA.

## Human closure items

- Approve Sentry destination/runtime wiring and inspect one synthetic scrubbed
  event.
- Identify staging and production Supabase project refs and verify staging
  separation, migrations, Auth, backup window, and Storage-object recovery.
- Approve staging EAS credentials/build/upload; verify internal TestFlight and
  Play Internal tester setup; record build ID and exact SHA.
- Run the 15–20 minute physical-device checklist.
- Run the synthetic operator run card once; record deviations and ambiguities.

Pilot remains **NO-GO** until the applicable human gates above are evidenced.
Production remains **NO-GO** while the accepted High advisory exception has
`productionStatus: BLOCKED`.

## Provider references checked 2026-10-08

- Supabase database backups exclude Storage API object bytes: https://supabase.com/docs/guides/platform/backups
- Supabase Storage object download/recovery options: https://supabase.com/docs/guides/storage/management/download-objects
- Expo TestFlight requires store distribution and uses App Store Connect/TestFlight: https://docs.expo.dev/submit/testflight/
- Expo Android submission profiles support explicit track/release status: https://docs.expo.dev/build/automate-submissions/
