# Shared Contracts and Freeze Policy

Parallelism begins only after shared contracts for the milestone are stable enough that agents are not inventing incompatible interfaces.

## Contract categories

### Identity Context
Minimum conceptual shape:
- authenticated user id;
- active club context;
- active team context if selected;
- resolved capabilities;
- managed player ids.

Do not expose sensitive auth provider internals as general app state.

### Player Summary
Guardian-safe:
- id;
- display name (first name + surname initial);
- jersey number;
- team id.

Staff-only extended view may include full legal/registered identity if operationally needed.

### Event Summary
- id;
- type;
- team;
- starts/ends;
- venue/court;
- status.

### Game Contract
Official:
- round;
- opponent;
- official start;
- official venue/court;
- fixture status;
- result;
- source.

Overlay:
- arrival;
- uniform;
- coach focus;
- team note.

### Attendance
Command:
- event id;
- managed player id;
- ATTENDING / UNAVAILABLE / UNSURE;
- optional category/note.

Result:
- canonical response;
- updated timestamp.

### Announcement
- scope;
- category;
- title/body;
- acknowledgement requirement;
- publish/expiry.

### Duty
- duty type;
- assignment;
- acknowledgement;
- swap state.

### Coaching stats
Per player/game:
- points;
- rebounds;
- assists;
- steals;
- fouls;
- approximate minutes.

### Post-game review
- team notes;
- private player notes;
- recognition;
- practice-focus outputs.

### Practice plan
- training id;
- title;
- ordered blocks;
- durations;
- drill reference/content;
- notes.

## Error contract

Map internal/provider errors to stable application errors such as:
- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- VALIDATION_FAILED
- CONFLICT
- STALE_WRITE
- UPSTREAM_UNAVAILABLE
- RATE_LIMITED
- INTERNAL

Do not make UI parse PostgreSQL/provider raw errors.

## Version/freeze policy

For an active parallel milestone:
1. Integrator publishes the contract.
2. Agents build against it.
3. Any breaking change returns to Integrator.
4. Integrator evaluates dependent work and either:
   - rejects the change;
   - versions/adapts compatibly;
   - pauses dependent work and updates the contract.

No worktree silently changes a shared DTO and fixes only its own code.
