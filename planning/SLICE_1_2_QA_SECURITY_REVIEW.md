# Slice 1.2 QA + Security Review

Independent review of Milestone 1, Slice 1.2. No product code was changed for this review. Findings were not fixed.

## Reviewed SHA

Committed HEAD: `cb5b06d70b020570873d8d050d1d7209bf46a479` (`feat(auth): harden mobile session persistence and refresh lifecycle`).

Slice 1.2 on this branch, from the first auth commit through that HEAD:

- `171a1fe` Australian mobile normalization and safe auth error mapping
- `77be03b` provider-neutral session lifecycle
- `539b37f` local email and phone sign-in
- `fadc863` and `3227970` adult identity linking policy
- `aacfcb9` email credential changes and disabled OAuth adapters
- `5bc3d28` disabled Google and Apple sign-in boundaries
- `cb5b06d` mobile session persistence and refresh lifecycle

The auth screens are not in that commit. They are uncommitted working-tree changes on top of HEAD: mobile gate and screen, web sign-in, callback route, live session wiring, and the Auth UX note in `planning/SLICE_1_2_IDENTITY.md`. This review covers that tree, not HEAD alone. A freeze tag on `cb5b06d` would omit the screens.

`apps/web/next-env.d.ts` was rewritten by Next type generation during the review and restored. It is not part of the slice.

## Review scope

Reviewed: Australian mobile normalization, auth error mapping, provider-neutral session lifecycle, SecureStore and mobile refresh, web SSR and cookie session, local email OTP, local phone OTP, magic-link callback, redirect allowlist, authorization URL validation, identity-linking policy, email credential change, phone credential linking fail-closed, OAuth sign-in and link boundaries, Google and Apple disabled configuration, mobile and web auth UX, logout, session restoration, and current-club-context integration.

Not reviewed as new work: Slice 1.3 and later. Hosted Google, Apple, Twilio, manual linking, and phone credential linking stay disabled. Those deferred hosts are not defects.

Framework notes used: `planning/SECURITY.md` and the slice criteria. The security-best-practices skill has Next.js server, React frontend, and general frontend reference files. This review applied those concerns (open redirects, auth cookies on redirects, secrets in the client) to the slice. No extra framework defect was found beyond the findings below.

## Automated evidence

All commands below were run in this review on Node 24.21.0. Typecheck used Turbo `--force` (0 cached). Local Supabase was the loopback API only. The secret key was not exported and is not recorded here.

| Gate | Result |
| --- | --- |
| `@stable/contracts` test | 25 passed. Statements, branches, functions, lines 100%. |
| `@stable/auth` unit test | 208 passed. Statements 98.51%, branches 96.78%, functions 100%, lines 98.49%. |
| `@stable/permissions` test | 8 passed. 100%. |
| `@stable/club-structure` unit test | 16 passed. 100%. |
| `@stable/current-club-context` unit test | 25 passed. 100%. |
| `@stable/mobile` Jest | 8 suites, 50 passed. Jest does not emit coverage. |
| `@stable/web` Vitest | 5 files, 37 passed. The web script does not emit coverage. |
| `turbo run typecheck --force` | 11/11 passed. |
| `eslint .` | Exit 0. |
| `@stable/web` production build | Passed with the local loopback URL and publishable key exported. Routes: `/`, `/auth/callback`, `/club-structure`. |
| Auth integration | `local-sign-in` and `email-credential`: 3 passed. After a 6 second wait, `identity-link`: 1 passed. |
| Club-context integration | 2 passed. |
| Fixture Playwright (`playwright.config.ts`, port 3107) | 3 passed. |
| Auth Playwright (`playwright.auth.config.ts`, port 3000) | 8 passed: member `club.read`, outsider with no membership, club admin season and team, outsider denied club structure, email code, phone code, magic link, sign out. |

Package branch coverage stays above the 90% gate. Three auth files are under 90% branches or statements on their own and do not fail the package gate: `oauth-sign-in.ts` 88.88% branches (missing Web Crypto), `email-credential.ts` 89.47% branches, `phone-credential.ts` 85.71% statements. The phone gap is the line after the fail-closed refusal. That line is not a success path.

## Manual QA

### Web

Checked in Chrome against `http://127.0.0.1:3000/` with the local publishable key.

- Unauthenticated welcome shows “Know what's next. Show up ready.”, Continue with mobile, and Continue with email. Continue with Google and Continue with Apple are absent.
- Both welcome buttons are 44px tall.
- Continue with email shows the email field, Send code, and Back. Back returns to the welcome buttons.
- Continue with mobile accepts `0412345678` and displays `0412 345 678`. The code was not submitted, so no SMS was sent.
- Callback `?code=short&next=https://evil.example` returns `307` to `http://127.0.0.1:3000/?auth=validation`. The external URL is not in `Location`.
- Callback `?code=abcdefgh&next=/\evil` returns `307` to `/?auth=validation`.
- Callback `?error=access_denied` plus extra text returns `307` to `/?auth=unavailable`. The query text is not copied into `Location`.
- Rendered HTML contains the publishable key. It does not contain `sb_secret_`, `service_role`, or a JWT-shaped `eyJ` value.
- Auth Playwright then signed in with the local email code, the local phone code, and a magic link, and signed out back to the auth entry. The magic-link assertion checks the landed URL does not contain `access_token`.

The live home waits on `restoreAuthSession` before choosing a screen. `shouldLoadClubContext` is true only for `authenticated`. Club context is loaded after that check. There is no client loading shell that can paint the admin frame first. Recovery renders “Sign-in is paused” and does not sign the user out. Expired renders the catalog sentence and the welcome form.

### Mobile

No simulator or device was available. Behaviour below is from the component tests and the source, not from a running app.

- The gate starts in `loading` and does not mount the club screen until `session.state === "authenticated"`.
- Welcome, phone, email, code entry, resend cooldown, invalid or expired catalog errors, and recovery are covered by `auth-screen.test.tsx` and `mobile-auth-gate.test.tsx` (included in the 50 Jest passes).
- Sign out calls `signOutLiveMobileAuthSession`, which uses scope `local`, then replaces the snapshot. A failed sign-out becomes recovery, not a silent logout.
- `SafeAreaView` wraps the route. The screen uses `KeyboardAvoidingView` with iOS `padding` and a `ScrollView`. Controls use `minHeight: 44`. There is no fixed-position overlay.
- Provider buttons are absent while `OAUTH_PROVIDER_SETTINGS` stays `enabled: false`.

## Responsive validation

Web, measured with Playwright `getComputedStyle` and element boxes:

| Width | Columns | Layout |
| --- | --- | --- |
| 390 | `390px` | One column. Brand bottom is above the panel. Heading does not overflow. |
| 1024 | `460.797px 563.203px` | Two columns, side by side. |
| 1280 | `576px 704px` | Two columns. |
| 1440 | `648px 792px` | Two columns. |

The 800px media query stacks the page. The narrow browser is not a cropped two-column layout. Desktop widths stay two columns, which matches that breakpoint.

Mobile 360, 393, and 430 were not rendered. See unverified findings. Static layout uses flexible stacks, horizontal padding, and scroll, not a fixed two-column frame.

## Accessibility

Reviewed statically, plus the 44px button measurement on the live web welcome.

- Web inputs and buttons set `min-height: 44px` and `min-width: 44px` on buttons. Live welcome buttons measured 44px.
- Web fields use `<label>`. Mobile fields set `accessibilityLabel` from the visible label. The code field is labelled “6-digit code”.
- Web `:focus-visible` draws a 2px green outline. Mobile buttons set `accessibilityRole="button"` and disabled state.
- Web heading order is one `h1` in the brand panel and an `h2` in the form (`Sign in`, `Sign-in is paused`, or the step title).
- Errors use `role="alert"` on the web and `accessibilityRole="alert"` plus `accessibilityLiveRegion="polite"` on mobile.
- OTP is one field, numeric, `maxLength` 6, `autoComplete` `one-time-code` or `sms-otp`. It does not submit on each digit.
- Forms use `onSubmit`, so Enter submits. No positive `tabindex` was found.
- Contrast of the Mustangs pairs used here: gold button text 13.23:1, inverse text 13.22:1, green on canvas 8.85:1, secondary text 9.90:1, mobile error on canvas 4.79:1. The web error pair is below AA. See S12-02.
- Reduced motion sets `scroll-behavior: auto`. The auth screen has no other motion.
- A live Tab walk was not performed. DOM order follows the visual order and does not trap focus.
- VoiceOver and TalkBack were not run. See unverified findings. That gap alone does not fail the slice. S12-02 and S12-03 are static defects and are counted.

## Session/security review

- Loading does not mount club context. Web and mobile both wait for an authenticated snapshot.
- Refresh and restore failures become `recovery` and do not clear the local session (`clearLocal: false` in `packages/auth/src/auth-session.ts`). Logout is a separate revoke.
- Expired is its own snapshot. The UI shows the catalog sentence and the sign-in form.
- `principalFromSession` keeps `userId` and an optional display name. Role and token fields are dropped. An authenticated snapshot is not `club.read`. The outsider Playwright case still has no membership.
- `loadLiveClubContext` and `CurrentClubContextScreen` run only after the authenticated branch.
- Live sign-out on web and mobile passes scope `local`. The button label is “Sign out”. It does not claim to revoke other devices. `global` remains available on the session API and is not what the buttons call. Success still depends on the follow-up read in `signOutAuthSession`.
- The UI does not add a second refresh loop. Web restore uses `getUser`. A missing session (`AuthSessionMissingError` with no user) is `none`, not expired. Mobile refresh stays on the existing AppState binding from `cb5b06d`.
- Callback exchange checks the return path before exchanging the code. Unsafe `next` values become the validation flag and are not echoed.
- Success and failure redirects use `http://127.0.0.1:3000`. Session cookies are copied onto the redirect response because `cookies().set` does not travel with `NextResponse.redirect`.
- Authorization URL policy remains the committed allowlist: loopback Auth or the hosted `*.supabase.co` `/auth/v1/authorize` shape. Public `requestOAuthSignIn` stays disabled.
- Auth UI files do not call `console.log`, Sentry, or PostHog. `safeAuthMessage` returns a catalog sentence for unknown errors, so raw GoTrue text is not rendered. The Australian mobile sentence is the validation message thrown before the provider and is shown as itself.
- `loadWebBootEnv` passes the secret into the boot check and returns `ClientEnvConfig` only. The browser client receives the URL and publishable key as props. The rendered document contained that public key and no secret key.

## Identity/linking review

- The application does not merge users. Identity decisions live in `decideIdentityLink`. `auth.users.id` is the principal id.
- Roles and capabilities are not written into auth metadata. The principal schema has no role field.
- `MANUAL_LINKING_IS_ENABLED` is `false`. `enable_manual_linking` in `supabase/config.toml` is `false`. OAuth `linkIdentity` stays refused.
- `PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED` is `false`. `requestPhoneCredentialChange` normalizes, asks the policy, and then throws `CONFLICT`. It has no provider gateway.
- Email change is the authenticated `updateUser` path with `double_confirm_changes = true` locally. Collision remains fail-closed in the linking policy. Integration coverage for that policy passed in this review.
- A different email or phone still creates a different auth user. Credential operations do not take a membership id and do not move club membership.
- `OAUTH_PROVIDER_SETTINGS.google` and `.apple` are `{ enabled: false, clientId: null }`. `oauthProviderReady` requires a parsed setting, a non-null `clientId`, and `enabled`. The public sign-in starter is not wired to the screens.

`supabase/config.toml` is local-shaped: `site_url` and the two redirect URLs are loopback and `stable://auth/callback`. Email confirmations are false with a comment not to copy that to a hosted project. The SMS block uses the placeholder `local-test-otp` and says it is not a Twilio account. The fictional test number lives only in `[auth.sms.test_otp]`. SMTP is commented out. MFA enrol and verify are false. Rate limits are the local defaults (`sign_in_sign_ups` 30, email `max_frequency` 1s, SMS `max_frequency` 5s). No live Twilio credential or service-role key is in that file. The test OTP must not be copied into application source or into a hosted project.

## Findings

### S12-01

- Severity: MEDIUM
- File/path: `apps/web/lib/provider-visibility.ts`, `apps/mobile/src/auth/provider-visibility.ts`, `apps/web/components/club-sign-in.tsx`, `apps/mobile/src/auth/auth-screen.tsx`, `apps/mobile/app/index.tsx`
- Behaviour: Provider buttons render when `OAUTH_PROVIDER_SETTINGS.google.enabled` or `.apple.enabled` is true. They do not require `oauthProviderReady` (`clientId !== null` and `enabled`). The web buttons have no `onClick`. The mobile live route does not pass `onProvider`, so the press calls an empty optional. `requestVisibleProvider` also returns early only on `enabled`.
- Why it matters: Turning Google or Apple enabled on, with no client id and no start handler, shows a button that cannot start sign-in. The shipped flags are false, so the buttons are hidden today. The tests only assert that current false pair.
- Reproduction/evidence: `visibleAuthProviders` returns `{ google: settings.google.enabled, apple: settings.apple.enabled }`. Web renders “Continue with Google” / “Continue with Apple” as `type="button"` with no handler when those flags are true (`club-sign-in.tsx` around the welcome buttons). Mobile `Welcome` calls `onProvider?.("google"|"apple")`. `apps/mobile/app/index.tsx` passes `providers={visibleAuthProviders()}` and no `onProvider`.
- Exact remediation: Hide each button unless `oauthProviderReady` is true for that provider and the screen has a real start handler. Do not render a button from `enabled` alone. Extend the web and mobile tests so `enabled: true` with `clientId: null`, and `enabled: true` with no start handler, still render no button.

### S12-02

- Severity: LOW
- File/path: `apps/web/components/club-sign-in.tsx` (`.club-sign-in-error`), tokens `error600` `#C53D3D` on `error100` `#FCE9E9`
- Behaviour: Web error text uses the error colour on the error-soft background at body size (the rule does not set a larger font).
- Why it matters: That pair is 4.37:1. WCAG AA for normal text is 4.5:1. The message is still text, not colour alone. Mobile error text sits on the canvas and is 4.79:1.
- Reproduction/evidence: Relative luminance of `#C53D3D` on `#FCE9E9` is 4.37. The same foreground on canvas `#F7F8F5` is 4.79.
- Exact remediation: Use a darker error foreground, or the canvas background, until the web error text is at least 4.5:1 at 16px.

### S12-03

- Severity: LOW
- File/path: `apps/mobile/src/auth/auth-screen.tsx` (`styles.heading` titles in `Welcome`, `IdentifierEntry`, and `CodeEntry`)
- Behaviour: Screen titles are `Text` without `accessibilityRole="header"`.
- Why it matters: VoiceOver and TalkBack will not expose those titles as headings. Buttons and fields are still labelled. Web already uses `h1` and `h2`.
- Reproduction/evidence: The welcome title “Know what's next. Show up ready.” and the step titles are plain `Text`. No `accessibilityRole="header"` is set on them.
- Exact remediation: Set `accessibilityRole="header"` on each screen title.

### S12-04

- Severity: UNVERIFIED
- File/path: `apps/mobile/src/auth/auth-screen.tsx`, `apps/web/components/club-sign-in.tsx`
- Behaviour: VoiceOver was not run.
- Why it matters: Heading order, OTP announcement, and error live regions can still fail on device even when the roles are present.
- Reproduction/evidence: No VoiceOver hardware session in this review.
- Exact remediation: Run VoiceOver on the iOS welcome, phone, email, code, error, recovery, and signed-in screens. Do not mark those checks passed until that happens.

### S12-05

- Severity: UNVERIFIED
- File/path: `apps/mobile/src/auth/auth-screen.tsx`
- Behaviour: TalkBack was not run.
- Why it matters: Same as S12-04 for Android, including the code field and alert text.
- Reproduction/evidence: No TalkBack session in this review.
- Exact remediation: Run TalkBack on the same mobile screens.

### S12-06

- Severity: UNVERIFIED
- File/path: `apps/mobile/app/index.tsx`, `apps/mobile/src/auth/auth-screen.tsx`
- Behaviour: Layout at 360, 393, and 430 was not rendered on a simulator or device.
- Why it matters: Keyboard overlap and safe-area insets can still clip the primary action on a real phone. The source uses `SafeAreaView`, scroll, and 44px minimums, which is necessary and not sufficient.
- Reproduction/evidence: No simulator was available. Web 390 was measured and is not a substitute.
- Exact remediation: Capture the welcome, phone, email, and code steps at 360, 393, and 430 with the keyboard open and closed.

## Unverified external gates

- VoiceOver (S12-04).
- TalkBack (S12-05).
- Mobile layout at 360, 393, and 430 (S12-06).
- Hosted Google, Apple, and Twilio. Left disabled on purpose.
- Staging and production redirect lists. They are empty. Local callback redirects stay on `http://127.0.0.1:3000`.
- A live keyboard-only Tab walk on the web form. Static order and `focus-visible` were reviewed.

These hardware and hosted gaps are deferred. They are not a freeze failure by themselves.

## Freeze recommendation

Do not tag `cb5b06d` alone. The auth UX is still uncommitted.

S12-01 is an actionable Medium defect: an enabled flag without a client id and a start handler would show a dead provider button. S12-02 and S12-03 are actionable Low accessibility defects. No Critical or High defect was found. Current users do not see Google or Apple buttons, and the local email, phone, magic-link, session, and sign-out paths passed.

Fix S12-01 before any change to `OAUTH_PROVIDER_SETTINGS`. Fix or explicitly accept S12-02 and S12-03. Device and screen-reader checks stay unverified until they are run.

PASS WITH CONDITIONS

# Remediation Delta Review

Reviewed only the change from the original review SHA to the remediated commit. Product code was not modified in this pass. The three findings below are the only items reopened.

## Baseline SHA
cb5b06d70b020570873d8d050d1d7209bf46a479

## Remediated SHA
31a2a9b06b8add78ee8b6d3121bb9303562475f7

`git diff cb5b06d..31a2a9b` is the auth UX commit. `packages/auth`, `packages/contracts`, and `supabase/config.toml` are not in that diff.

## S12-01
Status: CLOSED
Evidence:

`providerButtonReady` is `oauthProviderReady(settings) && typeof start === "function"` in `apps/web/lib/provider-visibility.ts` and `apps/mobile/src/auth/provider-visibility.ts`. `oauthProviderReady` still requires a successful `oauthProviderSettingsSchema` parse, a non-null client id, and `enabled`. The schema rejects a null or blank client id when enabled, and rejects `local-test-otp` and `env(` placeholders.

Web and mobile welcome buttons render only from that helper. The click calls the same function. `ClubSignInLive` and the mobile gate render the screens with no `onProvider` and no override of the frozen settings. `OAUTH_PROVIDER_SETTINGS` is still `{ enabled: false, clientId: null }` for Google and Apple. Setting `enabled` true, while the client id stays null or the screen still has no handler, does not render a button.

This delta review re-ran the closure tests on `31a2a9b`: mobile `auth-screen` and `mobile-auth-gate` 18 passed; web `club-sign-in` 12 passed. Those tests show disabled hidden, enabled with a null client id or the placeholder hidden, a valid client id without a handler hidden, and a ready provider visible and invoking the supplied handler for both Google and Apple.

## S12-02
Status: CLOSED
Evidence:

`.club-sign-in-error` sets `color: var(--sign-in-error)` and `background: var(--sign-in-surface)`. Those variables are `theme.color.state.error` (`#C53D3D`) and `theme.color.background.surface` (`#FFFFFF`). No separate hex was added for the error chip. The rule does not reduce the font size, so the 4.5:1 body-text threshold applies. Measured contrast of that pair is 5.11:1. The previous error-on-error-soft pair remains 4.37:1 and is no longer used here. The web test asserts the surface background and a ratio of at least 4.5:1.

## S12-03
Status: CLOSED
Evidence:

`accessibilityRole="header"` is set on the welcome title, the shared entry title (`Your mobile`, `Your email`), the shared code title (`Enter the code` for phone and email), and `Sign-in is paused`. The expired state keeps `Your session has ended. Sign in again.` as `accessibilityRole="alert"` and still shows the welcome title as the header. The mobile tests query those header names, including expired and recovery. VoiceOver and TalkBack were not run.

## Regression evidence

`packages/auth` and `packages/contracts` are unchanged from `cb5b06d`, so the auth architecture, contracts, manual-linking flag, phone-credential flag, Google and Apple enabled state, authorization URL checks, and the error catalog were not edited. Live sign-in still does not pass a provider handler.

Closure tests re-run for this delta review: mobile auth screen and gate, 18 passed; web club sign-in, 12 passed.

The wider gates below were run on this same tree immediately before `31a2a9b`. No product file changed after that commit. They were not repeated in this delta pass.

- Mobile Jest: 53 passed
- Web Vitest: 40 passed
- Auth unit: 208 passed
- Contracts: 25 passed
- Current-club-context unit: 25 passed
- Fixture Playwright: 3 passed
- Auth Playwright: 8 passed, including email code, phone code, magic link, and local sign-out
- Forced workspace typecheck: 11/11
- `eslint .`: passed
- Web production build: passed

Web layout measured on that same tree: 390 one column; 1024, 1280, and 1440 two columns. Google and Apple text was absent at each width. The narrow-web finding stays closed.

## Remaining unverified items

- VoiceOver
- TalkBack
- Mobile layout at 360, 393, and 430

These were already deferred. No new static defect was found in the remediation.

## Final recommendation

S12-01, S12-02, and S12-03 are closed. No new Critical, High, Medium, or Low defect was found. The only open items are the deferred device and screen-reader checks.

PASS
