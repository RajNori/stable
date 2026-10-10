# Authentication, Identity Linking and Session Rules

## M5B platform contract

Supabase Auth is the sole authentication authority. The approved pilot
experience is intentionally different by client:

| Client | Normal sign-in | Recovery / alternative |
|---|---|---|
| Web dashboard | Google, Facebook, email + password | Password reset by neutral request and single-use recovery link |
| Mobile | Australian SMS OTP (six digits) | Email magic link via `stable://auth/callback` |

- Web SMS OTP and routine email magic-link login are not normal sign-in methods.
- Social-only users are not offered a password reset flow that cannot help them.
- Do not add mobile password login or automatically add Google/Facebook to mobile.
- Apple sign-in is outside the approved M5B target.
- Players do not authenticate in V1.
- Authentication proves adult identity only; it never creates membership or grants a capability.

Web requirements are WEB-AUTH-01 through WEB-AUTH-12 in the M5B traceability
matrix. Passwords, recovery tokens and provider tokens are handled only by
Supabase/provider SDKs and never enter app logs, analytics or audit metadata.

## User vs profile vs player

- Auth User = authenticated adult principal.
- Profile = adult application profile.
- Player = junior basketball participant.
- Player is not an Auth User in V1.

## Phone and email

Store canonical phone as E.164 where application metadata needs it. Australian
UX may accept `04xx...` but normalize before use. Never log OTP values.

Normalize email according to provider/Auth behavior. Do not create custom
case-folding rules that conflict with Auth.

## Account linking policy

Account linking is security-sensitive. Allow automatic linking only when the
active Supabase/provider behavior guarantees the identity relationship safely.
Before provider enablement, inspect the exact Supabase Auth version/configuration
and automatic identity-linking behavior.

Never merge two app users because:
- display names match;
- guardian names match;
- child relationship appears similar;
- phone/email was typed into an invitation but authentication did not prove it.

Google/Facebook may satisfy an email-bound invitation only when the provider
email is verified. Apple private-relay behavior is not in the M5B sign-in target.
Where ambiguity exists, require explicit authenticated linking/recovery. If
provider semantics remain ambiguous, stop only that provider subtask and
continue unrelated work.

## Invitation acceptance

An invitation can constrain intended email and/or phone, team, intended staff
role/guardian relationship and expiry. Acceptance requires:

1. authenticated adult User;
2. invitation active, not expired, consumed or revoked;
3. verified authenticated identity satisfies its intended identity constraint;
4. target team/relationship is still valid;
5. membership/relationship creation and invite consumption are transactional;
6. an audit event is emitted without secrets or child names.

An unconstrained invitation must not grant sensitive membership by default.
Never match by display name, surname or child relationship, and never silently
merge two existing adult identities.

## Session and authorization

Mobile:
- use secure platform storage;
- restore and refresh sessions safely;
- retain callback-race guards;
- clear user-specific query/offline cache on logout and account switch.

Web:
- use Supabase-supported server/browser session patterns;
- protected routes render the real sign-in experience and a safe return path;
- route middleware is not authoritative authorization.

Authentication alone never creates club/team access. Resolve active
ClubMembership, TeamMembership, GuardianRelationship and PlayerTeamRegistration
for every protected action. Removing membership/relationship must deny the next
authoritative request through capabilities/RLS; do not depend on stale JWT claims.

## Web password recovery

- Use Supabase-supported password and recovery APIs; do not create custom
  password hash/token/recovery tables.
- Return the neutral response: “If an account exists for this email, we’ve sent
  recovery instructions.”
- A recovery link is short-lived and single-use and enters a restricted recovery
  session until the user sets a new password.
- After password update, resolve normal active membership and show “No active
  club access” when none exists.
- Social-only accounts must not be presented with an unusable password-reset
  experience.

## Recovery cases

Define safe support handling for changed/lost phone, lost email, provider
identity confusion and duplicate adult accounts before production. Club Admin
must not receive an unsafe “merge any two users” control.

## Tests

- phone OTP and email magic-link adapters;
- Google/Facebook provider callback and verified-email behavior;
- email/password registration/sign-in and neutral password recovery;
- invitation intended identity, expired/revoked/replayed state;
- multi-provider same-adult behavior and two adults with the same display name;
- membership/relationship removal while an auth session remains active;
- callback allowlist, malformed/replayed callback and environment mismatch;
- account-switch cache cleanup and no Player authentication.
