# Observability

## Error reporting
Sentry for:
- Expo mobile;
- Next.js;
- server/edge operations.

Scrub PII/private notes.

## Structured logs
Include:
- correlation/request ID;
- environment;
- operation name;
- club/team opaque IDs where safe;
- actor opaque ID where necessary;
- outcome/duration.

Never include tokens or private child notes.

## Product analytics
PostHog events may include:
- game_day_opened;
- attendance_confirmed;
- training_opened;
- announcement_acknowledged;
- duty_swap_requested;
- post_game_review_completed;
- practice_plan_created.

No child names.

## Operational metrics
Track:
- PlayHQ sync success/failure;
- push delivery failure rates;
- auth errors;
- application-operation latency;
- crash-free sessions.

## Alerts
Pilot can begin with simple high-signal alerts. Avoid alert fatigue.
