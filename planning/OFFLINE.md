# Offline Game Day

## Goal
A guardian should still be able to read the critical Game Day snapshot inside a poor-reception stadium.

## Cached fields
Minimum necessary:
- team;
- opponent;
- date/time;
- arrival time;
- venue/court;
- uniform note;
- coach focus;
- own child's RSVP state;
- own duty;
- minimal cached team availability summary if already authorized.

Avoid caching private player notes or unnecessary guardian contact data.

## Behaviour
- online load writes versioned snapshot;
- offline screen shows `Offline · Last updated <time>`;
- stale snapshot remains readable;
- reconnect triggers background refresh;
- changed official fixture gets a clear update state after refresh.

## Mutations
MVP default: do not silently queue high-impact commands offline.
RSVP offline behaviour must be explicitly selected:
- either disable with explanation;
- or queue with visible pending state and idempotent replay.

The team must decide before implementing RSVP queueing.

## Security
Clear user-specific cache on logout/account switch.
Separate snapshots by authenticated user and team.
