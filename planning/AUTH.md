# Authentication, Identity Linking and Session Rules

## V1 providers
- Australian phone OTP.
- Email OTP or magic link.
- Sign in with Apple.
- Sign in with Google.

Supabase Auth is the authentication authority.

## User vs profile vs player
- Auth User = authenticated adult principal.
- Profile = adult application profile.
- Player = junior basketball participant.
- Player is not an Auth User in V1.

## Phone
Store canonical phone as E.164 where application metadata needs it.
Australian UX may accept `04xx...` but normalize before use.

Never log OTP values.

## Email
Normalize safely according to provider/auth behaviour. Do not create custom case-folding rules that conflict with Auth.

## Social auth
Apple private-relay email must be treated as a valid provider identity, not automatically merged with another account by name.

## Linking policy
Account linking is security-sensitive.

Allowed automatic linking only when Supabase/provider guarantees the identity relationship safely.

Never merge two app users because:
- display names match;
- guardian names match;
- child relationship appears similar;
- phone/email was typed into an invitation but authentication did not prove it.

Where ambiguity exists, require explicit authenticated linking/recovery flow.

## Invitation acceptance
An invitation can constrain:
- intended email and/or phone;
- team;
- intended staff role or guardian relationship;
- expiry.

Acceptance requires:
1. authenticated User;
2. invitation active/not expired/not used/revoked;
3. authenticated identity satisfies intended identity constraint if set;
4. target team/relationship still valid;
5. transactional membership/relationship creation;
6. invite marked consumed;
7. audit event.

## Session
Mobile:
- use recommended secure persistence;
- restore session;
- clear user-specific cache on logout/account switch.

Web:
- use Supabase-supported server/browser session patterns for the chosen Next.js version;
- do not treat route middleware/proxy as sufficient authorization.

## Revocation
Removing club/team membership must take effect on the next authoritative query immediately through DB/RLS/capability resolution; do not depend only on JWT custom claims that may remain stale.

## Recovery
Define before production:
- changed/lost phone;
- email access lost;
- Apple/Google identity confusion;
- duplicate account discovered.

Club Admin must not have an unsafe "merge any two users" button in MVP.

## Tests
- phone OTP flow adapter;
- email flow adapter;
- invitation intended identity;
- expired/revoked/replayed invite;
- multi-provider same adult;
- two different adults with same display name;
- removed membership while session remains active.
