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
- valid stale snapshot remains readable with a visible stale state;
- missing, corrupt, wrong-user, wrong-team, or unauthorized snapshots fail closed;
- reconnect starts an authoritative refresh;
- cached fixture changes are reflected only after successful refresh;
- network connectivity by itself does not restore mutation capability;
- after a failed refresh, Game Day remains read-only until a successful refresh.

## Mutations
Game Day is read-only offline. RSVP, attendance, fixture, duty, and check-in
mutations are unavailable while offline. There is no mutation queue, replay
queue, pending RSVP state, or optimistic offline mutation. The online write
path becomes available only after an authoritative refresh succeeds.

## Security
Clear user-specific cache on logout/account switch.
Separate snapshots by authenticated user and team.
