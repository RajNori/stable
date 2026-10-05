# Domain Model

## Core identities

### User
Authenticated adult identity.

### Profile
Display/contact metadata associated with User.

### Player
Junior participant. Not an Auth user in V1.

### GuardianRelationship
Links a User to a Player with relationship/management permissions.

A Player may have multiple guardians.
A User may guard multiple Players.

---

## Organisation

### Club
Tenant root.

### Season
Named period belonging to Club.

### Competition
Competition context and external mapping metadata.

### Team
Belongs to Club and Season. May map to an external competition/team.

### Venue
Reusable venue/court metadata. Do not store unnecessary child location history.

---

## Access

### ClubMembership
User -> Club capability role such as CLUB_ADMIN.

### TeamMembership
User -> Team role such as HEAD_COACH, ASSISTANT_COACH, TEAM_MANAGER.

Guardian access does not need to be represented as a fake team role; it derives from GuardianRelationship + Player team registration/membership.

### PlayerTeamRegistration
Player -> Team within season, including jersey number/status.

---

## Events

### Event
Common scheduling identity:
- GAME
- TRAINING
- possibly CLUB_EVENT later.

Keep shared scheduling fields here.

### Game
Specialised game data:
- competition;
- round;
- opponent;
- official schedule;
- official result;
- source;
- team overlay.

### TrainingSession
Specialised practice data:
- recurring-series link;
- coach;
- check-in;
- practice-plan link.

Do not create a huge nullable event table containing every subtype field.

---

## Attendance

### AttendanceResponse
Player + Event:
- ATTENDING
- UNAVAILABLE
- UNSURE

UNANSWERED should normally be derived from absence of response.

Store responder User and timestamps.

---

## Duties

### Duty
Definition/type for event.

### DutyAssignment
Duty -> Guardian/User.

### DutySwapRequest
Open/targeted request with transactional acceptance.

### DutyAllocationRun
Optional audit record for automatic fair rotation preview/commit.

---

## Fill-ins

### FillInRequest
Game + number needed + note + state.

### FillInCandidateResponse
Eligible Player/Guardian response.

### FillInConfirmation
Manager-confirmed assignment.

Eligibility is abstracted because SBA/competition rules may change.

---

## Communication

### Announcement
Team-scoped or club-scoped communication.

### AnnouncementAcknowledgement
User acknowledgement state.

### NotificationDelivery
Channel attempt and outcome.

### DeviceEndpoint
Expo push token/device registration.

---

## Coaching

### GamePlayerStat
Player + Game:
- points;
- rebounds;
- assists;
- steals;
- fouls;
- approximate minutes.

### PostGameReview
Team-level review for Game.

### PlayerGameNote
Private staff-authored note for Player/Game.

### Recognition
MVP/Player of Game or category recognition. Internal visibility rules are explicit.

### PracticePlan
Training-linked plan.

### PracticeBlock
Ordered timed block.

### Drill
Reusable drill definition, initially team/club owned.

### PracticeFocus
Link from review observations to future practice.

---

## Audit

### AuditEvent
Security/operational history:
- actor;
- action;
- target;
- club/team context;
- timestamp;
- metadata with no secrets.

---

## State-machine requirements

Explicit state machines are required for:
- invitation;
- duty swap;
- fill-in request;
- training series edits;
- fixture sync reconciliation;
- notification delivery;
- post-game review completion.

Invalid transitions must be tested.
