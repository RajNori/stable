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
