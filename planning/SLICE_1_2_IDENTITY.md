# Slice 1.2 identity and linking

This note freezes adult identity linking before Apple or Google work. It does not enable manual linking, hosted providers, or a merge action.

The local Auth image is `public.ecr.aws/supabase/gotrue:v2.197.0`. Its linking rules are `DetermineAccountLinking` in that image. `enable_manual_linking` is a separate switch.

## Stable adult

`auth.users.id` is the only stable adult id. `public.profiles.user_id` is one-to-one with that id. Slice 1.2 does not insert a profile at sign-in, and an extra credential must not insert one either.

A provider identity is a credential on that adult. It is not a second application user. Email, phone, Apple, and Google are Auth identities. Authorization and roles stay out of auth metadata.

## Automatic linking

GoTrue can attach a new OAuth identity during sign-in when its own rules say the email is safe to match. The application does not perform that merge and does not add a second decision on top of it.

On this image, an OAuth email is eligible for automatic linking when the provider marks it verified, or when mailer autoconfirm is on. If exactly one non-SSO user already has that email, GoTrue links the new identity to that user. If the email is not eligible, GoTrue creates a separate account and does not copy a duplicate email onto it.

`enable_manual_linking = false` does not turn this off. It only blocks `linkIdentity` and `unlinkIdentity`. It does not govern email or phone `updateUser` flows.

## Application-inferred merge

The application never merges two adults because:

- display names match
- names look similar
- phones look similar
- an email is unverified
- metadata looks similar
- an Apple private-relay address differs from an existing email
- Google and Apple return different emails

Those cases stay separate users. There is no merge-users action.

## Manual linking mechanisms

A signed-out sign-in is not a link. If the candidate credential already belongs to another adult, the result is `CONFLICT` and the catalog sentence `This sign-in method can't be added.` The application does not infer a merge. Removing the last remaining sign-in identity is refused. Cancelling a link leaves the current session in place. Replaying a completed OAuth link does not create a second identity or a second profile.

### OAuth

Google and Apple use `linkIdentity()` for an authenticated adult. That call requires `enable_manual_linking`. The flag stays false until that OAuth flow is implemented. Turning it on is a deliberate local Auth change. An identity already owned by another adult is `CONFLICT`. The callback must be an allowlisted URL. The credential is established only when that callback completes.

### Email

Adding or changing an email uses authenticated `updateUser()`. `enable_manual_linking` does not govern that call. The credential stays unestablished until verification completes. Each environment sets its own email-change mode explicitly: `double_confirm` or `new_address_only`. An unset mode is refused. Local config sets `double_confirm_changes = true`.

### Phone

Adding or changing a phone would use authenticated `updateUser()`, after `normalizeAustralianMobile`. `enable_manual_linking` does not govern that call.

`auth.users.phone_change` is not unique. GoTrue can confirm a stale or duplicate pending number onto a different adult than the signed-in session. A stale or ambiguous `phone_change` is refused. Production phone credential linking stays unimplemented until a cleanup and uniqueness strategy for that column is defined and tested. `PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED` stays false.

`requestPhoneCredentialChange` is the account-management entry. It fails closed and has no provider gateway. Phone OTP sign-in is a separate operation and stays available.

## Credential operations

An authenticated adult changes email through `requestEmailCredentialChange` and `verifyEmailCredentialChange`. `updateUser({ email })` stays inside the Supabase adapter. The result is `pending` until verification reports the mailbox committed, and `auth.users.id` stays the same. Cancelling the flow does not switch the adult. Local mode is `double_confirm`. Staging and production stay `unset`, so those environments refuse the operation until a mode is set. Local mailer autoconfirm can still let GoTrue commit a secure email change on the first confirmed code. The application follows the committed mailbox, and it does not treat the request itself as verification.

Google and Apple explicit links go through `requestOAuthIdentityLink`, which calls `linkIdentity` only from the adapter. Both providers ship disabled, with no client id and no placeholder credential. `enable_manual_linking` stays false, so the operation returns `CONFLICT` before the provider. A cancelled or completed callback keeps the current adult. Live provider verification is a later human-gated step. The application still does not merge adults from email, name, or metadata.

## Local email confirmation

Local `enable_confirmations` is false, so GoTrue mailer autoconfirm is on. A verified local email OTP sets `email_confirmed_at`. The same switch also makes GoTrue treat an unverified provider email as verified for automatic linking.

That is local test convenience. Staging and production keep their own confirmation policy. This local switch must not be copied there, and it is not the hosted identity rule.

## What local sign-in does

One verified credential resolves to one Auth user.

- A new email, after the code or magic link is verified, creates one user when email signup is enabled.
- The same email verified again returns that same user id.
- A new Australian mobile, after the test code is verified, creates one user when SMS signup is enabled locally.
- The same mobile verified again returns that same user id.
- An email user and a phone user stay two users.

The acceptance response is the same whether or not the account already exists.

## User-facing email

One email is the product flow. The local magic-link template puts a 6-digit code and a sign-in link in that same message. The user-facing path asks for the code. The link is the same sign-in, completed by the callback exchange.

## Local proof only

Local email is captured by Inbucket on `http://127.0.0.1:54324`. SMTP is not enabled.

Local phone uses `[auth.sms.test_otp]` for the fictional mobile `+61400000000`. The test code lives only in `supabase/config.toml`.

CLI 2.118 keeps phone login off unless an SMS provider block is enabled. Local config sets `[auth.sms.twilio]` with the placeholder `local-test-otp` so phone login can start. That value is not a Twilio credential. Do not copy that block to a hosted project.

Local callbacks, and no others, are executable:

- `http://127.0.0.1:3000/auth/callback`
- `stable://auth/callback`

Staging and production redirect lists are empty. Hosted Auth, Apple, Google, and a real SMS provider are unchanged.
