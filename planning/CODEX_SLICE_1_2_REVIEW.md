# Codex Independent Review — Slice 1.2 Adult Authentication

## Reviewed range

`slice-1.1..HEAD` (`slice-1.1` is an ancestor of `HEAD`). The initial worktree was clean. `HEAD` contains `planning/SLICE_1_2_QA_SECURITY_REVIEW.md`. The changed-file list contains no Slice 1.3 implementation; the Slice 1.3 entry in `planning/PLAN.md` is roadmap scope only. No tracked test artifacts, generated credentials, dependency additions, or production deployment/config mutations were found. `git diff --check slice-1.1..HEAD` passes.

## Reviewed SHA

- `slice-1.1`: `32a7273706fc38196922e950c2aebea0a400ad9c`
- `HEAD`: `707d8baf61b18a69faf153e465ccccee92ea82f4`

## Executive result

**PASS WITH CONDITIONS.** The adult authentication implementation otherwise maintains the documented boundary between authentication and authorization, and the current local flows and UI gates are sound on source review. One concrete gap remains in the authorization URL validator: percent-encoded parameter names and double-encoded email values bypass checks intended to prevent session material and email leakage. Google and Apple are disabled and have no live start handler, so this is not an exposed current sign-in route. Fix the validator and add regression cases before enabling or wiring OAuth.

## Architecture review

`AuthSessionSnapshot` is a strict provider-neutral contract containing only lifecycle status and a safe principal (`userId` and optional display name); it carries no session, access/refresh/provider/ID token, role, or capability. Provider adapters map the Supabase adult `auth.users.id` to that principal and discard provider metadata and tokens. No role metadata, client service-role key, or secret-key path was found in the reviewed delta. Player identity remains a non-authenticated profile concern, not a second authentication principal.

Authentication is not used as authorization proof. `current-club-context` remains separately authenticated and relies on its contextual/RLS path. Identity linking and credential operations do not create/merge profiles or transfer memberships. Provider-specific session details stay in the infrastructure adapters.

## Session review

Mobile and web represent loading, unauthenticated, authenticated, expired, and recovery states distinctly. Mobile restores via SecureStore, uses chunked storage with integrity metadata, removes legacy/corrupt data safely, refreshes only while active, and moves refresh/provider failures into recovery rather than silently declaring logout. Web uses server-side `getUser` for SSR and cookie-backed sessions; the browser client uses public configuration. Neither UI resolves authenticated content before session resolution, and club context is gated behind authenticated state.

Logout flows do not claim that local sign-out instantly invalidates an already-issued JWT. Global sign-out is modeled separately, and failed provider confirmation does not become an optimistic success. The UI has one session authority per platform. An authenticated snapshot is not treated as permission to perform club operations.

## OTP / email review

Australian mobile normalization accepts the intended Australian mobile forms and emits E.164; malformed, non-mobile, or out-of-range input is rejected before provider invocation with fixed safe copy. OTP values are transient UI/input data and are not persisted or logged. Auth errors map to the fixed catalog; provider messages and submitted email/phone values are not included in application-facing error text.

The primary email and phone code flows, email magic-link completion, and authenticated email update are distinct. Email credential changes return address-free results and require the configured double-confirm behaviour. Collision outcomes fail safely. Phone credential linking remains explicitly disabled because the `phone_change` cleanup/uniqueness ambiguity is unresolved; phone OTP sign-in remains available. No evidence of application-side identity merging by name, similar phone, unverified email, Apple relay address, or cross-provider email was found.

## Redirect/callback review

The local web and mobile callbacks are exact allowlisted values. Return paths are restricted to safe internal paths; absolute, protocol-relative, malformed, and unsafe-scheme values are rejected. Callback completion consumes the authorization code without rendering it, maps failures to safe catalog messages, and redirects only to the validated return path. Callback replay/error paths do not expose codes or tokens in UI copy. Hosted staging and production redirects remain empty by design.

**Finding S1.2-01:** `packages/contracts/src/credential.ts`, `isSafeOAuthAuthorizationUrl` (around lines 65–104). The validator checks token parameter names and email indicators against the raw URL, then calls `decodeURIComponent` only to check malformed escapes and discards the decoded value. It does not parse or canonicalize query parameter names and values. Consequently, `...?%61ccess_token=secret` and `...?email=person%2540example.com` pass the validator despite representing an encoded session-token parameter and a double-encoded email. The current tests cover literal token names, literal email, and a single `%40`, but not encoded parameter names or double encoding. This defeats the validator’s stated guarantee and could allow sensitive query data to flow into an OAuth authorization/navigation URL if a provider path is later enabled. Parse the URL and validate decoded parameter names/values (including bounded repeated decoding or rejection of nested encodings); reject session-material keys and email-bearing values, and add bypass regression tests. Keep this condition closed before OAuth enablement.

## Identity/linking review

The implementation distinguishes Supabase-controlled automatic linking from explicit `linkIdentity()`, authenticated email `updateUser()`, and phone credential update. Manual OAuth linking is frozen off; provider linking checks authenticated principal, policy, redirect, and provider readiness. Signed-out OAuth sign-in uses its separate `signInWithOAuth` / `signInWithIdToken` boundary. Phone update remains fail-closed and cannot transfer memberships. Email change results do not expose the changed address. No application merge based on names, similar phone numbers, unverified email, Apple relay addresses, or different provider emails was found.

## Google/Apple boundary review

Google and Apple settings remain disabled with null client IDs, no hosted credentials, and no live start handler on either screen. The provider visibility helper requires valid enabled settings, a usable client ID, and an actual handler; enabling only the flag cannot expose a dead button. Raw provider navigation URLs are validated before being returned by the package boundary. The authorization URL gap is S1.2-01. Apple nonce construction is structurally correct: a cryptographically generated raw nonce is hashed for the provider and the raw nonce is supplied to Supabase. No fake-provider E2E is represented as live provider verification. Live Google/Apple proof is intentionally deferred.

## UI/security review

Mobile and web auth presentation gates authenticated UI until session resolution and load club context only after authentication. Recovery is not labeled as logout, routine errors use safe accessible messages, OTP is not stored, and unavailable provider buttons are hidden. Web uses semantic headings and the remediated error foreground on a surface background (reported and asserted contrast 5.11:1). Mobile screen titles, recovery, and paused states expose header semantics. The committed QA review’s closures for provider readiness (S12-01), web error contrast (S12-02), and mobile headings (S12-03) were independently checked in source and relevant tests.

## Secrets/config review

`supabase/config.toml` is local-only: loopback site/redirect URLs, local email-confirmation behaviour documented separately from hosted policy, and a clearly labeled local test OTP/Twilio placeholder. SMTP remains unconfigured. No real Twilio, Google, Apple, Supabase service-role, or other client secret was found in the changed source/config. Client initialization uses publishable/public configuration. No credential values are reproduced here.

## Test evidence

Independently rerun on this tree:

- Contracts: 25 passed.
- Auth unit suite: 208 passed.
- Mobile Jest: 53 passed.
- Web Vitest: 40 passed.

The wider committed QA report also records current-club-context (25), fixture Playwright (3), Auth Playwright, workspace typecheck (11/11), ESLint, web production build, and local auth integration results. Those wider results were not all rerun during this final review; no new claim of independent execution is made for them. Relevant callback, identity/link, OTP, lifecycle, provider-readiness, and contract tests were source-reviewed. The existing auth URL tests omit the encoded bypass cases described above.

The local Docker/Supabase stack was visible and running on the host; Docker is not unavailable. The local Supabase environment variables needed by the integration suite were unset, so local integration tests were not independently rerun. This is an environment/configuration limitation, not a sandbox denial. The integration test source was reviewed; it targets the loopback local stack and test OTP/mail flows, with no hosted target or database reset in the inspected helpers.

## QA remediation verification

The committed QA/security review includes the initial findings and their closure delta. Independently verified all three closures: provider controls require readiness and a start handler; web error text now uses the surface color pair and a test checks contrast; mobile titles carry header semantics. The documented VoiceOver, TalkBack, and 360/393/430 mobile layout checks remain unverified and are not treated as defects by themselves.

## Findings

### S1.2-01 — MEDIUM — OAuth authorization URL canonicalization

- **Location:** `packages/contracts/src/credential.ts`, `isSafeOAuthAuthorizationUrl`.
- **Behaviour:** Raw substring checks can be bypassed with encoded query keys and double-encoded email values; decode validation does not inspect the decoded URL.
- **Impact:** The safety contract does not reliably reject session material or email leakage in an authorization URL. Risk becomes reachable if OAuth is enabled and such an URL is passed to navigation.
- **Evidence:** The committed tests reject literal `access_token`, literal email, and single-encoded `%40`; they do not cover `%61ccess_token` or `%2540`. The code scans the raw URL and discards the result of `decodeURIComponent`.
- **Recommended remediation:** Canonical-parse the URL and validate decoded parameter names and values, rejecting session-token keys and email-bearing values (including nested encodings); add encoded and double-encoded regression tests before enabling OAuth.

## Uncertain / sandbox-unverified items

No sandbox denial affected the review. Local integration tests were not rerun because the required local Supabase environment variables were unset, despite Docker services running. Hardware VoiceOver/TalkBack and mobile visual validation at widths 360, 393, and 430 remain unverified as stated in the QA evidence.

## Deferred external gates

Real Twilio, hosted Google and Apple credentials/provider proof, manual OAuth linking, phone credential linking, and physical/simulator/screen-reader validation are intentionally deferred. They are not defects by themselves. OAuth must remain disabled until S1.2-01 is closed; hosted redirect allowlists and provider proof remain future gates.

## Freeze recommendation

**PASS WITH CONDITIONS** — the slice is otherwise reviewable, but close S1.2-01 and add bypass regression coverage before enabling or wiring OAuth. No Critical or High finding was identified. No product code was modified, and no commit, tag, push, provider enablement, or infrastructure mutation was performed.
