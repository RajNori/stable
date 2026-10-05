# ADR 0010 — Read-Only Offline Game Day
Status: Accepted

## Decision
Cache minimum critical Game Day state per user/team. Show last-updated/stale state. High-impact offline mutations are not silently queued until separately designed.

## Open detail
Offline RSVP queueing remains an implementation-time decision and requires explicit UX/idempotency plan.
