# Notifications

## Principles
- actionable;
- sparse;
- recipient-correct;
- event-driven;
- non-blocking.

## MVP types
- FIXTURE_CHANGED
- GAME_REMINDER
- RSVP_REQUIRED
- TRAINING_CHANGED
- TRAINING_CANCELLED
- ANNOUNCEMENT_PUBLISHED
- DUTY_ASSIGNED
- DUTY_SWAP_REQUESTED
- DUTY_SWAP_ACCEPTED
- FILL_IN_REQUESTED
- FILL_IN_CONFIRMED
- COACH_CHECKED_IN

## Recipient resolution
Never send to "all team users" by default.
Each notification defines actor types and exclusions.

Example:
RSVP_REQUIRED -> guardians managing an active player on that team who has no response.

## Device model
A user may have multiple devices.
Deactivate provider-invalid tokens.
Logout from one device should not unregister other devices.

M5B mobile UX owns permission request, Expo token acquisition, registration,
refresh/re-registration, authenticated endpoint association and safe logout or
account-switch cleanup. A user must never type a push token. A trusted server
dispatcher rechecks current recipient eligibility and preferences before send,
records provider outcomes/receipts, deactivates invalid endpoints and suppresses
duplicate delivery. Push remains best-effort and cannot roll back the source
operation.

## Content privacy
Push previews should not include private player notes or sensitive absence reasons.

## Trusted Expo dispatch implementation status (2026-10-12)

The local dispatcher claims one request and one active endpoint at a time. Its
database boundary rechecks recipient eligibility, current membership/relationship,
and category preference both when claiming and immediately before sending. The
message contains a generic body plus opaque request/type identifiers only.
Service-role-only RPCs persist provider tickets and receipts; `DeviceNotRegistered`
deactivates that endpoint. A claim that has entered the provider-send phase is
not automatically retried after an ambiguous failure, avoiding duplicate
delivery when Expo may already have accepted it. Provider errors are normalized
to an allowlist.

The migration, two Supabase Edge Function handlers, provider adapter and local
tests are implemented, but are not deployed or scheduled. Hosted use requires
the staging privileged-key incident to be resolved and a private dispatch
secret configured. No EAS project ID is present, and no staging push or physical
device receipt has been verified. These local results do not close the push
pilot gate.

## Idempotency
Use deterministic event/delivery keys where duplicate domain events are possible.

## Quiet hours/preferences
MVP may implement simple category preferences; emergency/urgent operational rules must be explicit rather than bypassing preferences ad hoc.

## Testing
- recipient resolver;
- duplicate suppression;
- failure/retry;
- invalid token;
- multiple devices;
- revoked team membership before send.
- permission granted/denied, token replacement, foreground/background/terminated receipt, authorized deep-link navigation, deleted target, logout/account switch and duplicate user-visible delivery on supported devices.
