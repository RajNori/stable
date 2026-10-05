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
