# Architecture

## 1. Style

The Stable uses **Vertical Slice Architecture**.

A feature slice owns the behaviour required to complete one meaningful user capability. Avoid horizontal architecture where all controllers, all services and all repositories live in giant cross-feature folders.

Example conceptual slice:

```text
features/attendance/
  domain/
  application/
  contracts/
  infrastructure/
  tests/
```

Client-specific presentation remains inside each app.

---

## 2. Target repository

```text
apps/
  mobile/
  web/

packages/
  domain/
  features/
  contracts/
  api-client/
  auth/
  permissions/
  validation/
  notifications/
  observability/
  design-tokens/
  config/
  testing/

integrations/
  playhq/

supabase/
  migrations/
  functions/
  tests/
  seed/

planning/
scripts/
test/
```

Do not create packages before a real dependency boundary exists.

---

## 3. Runtime topology

```text
Expo iOS/Android
    |
    | safe reads under RLS
    v
Supabase PostgREST / Realtime
    |
    | explicit commands where business rules require
    v
Application operations (Edge Function / DB RPC / trusted server boundary)
    |
    v
PostgreSQL

Next.js Admin on Vercel
    |
    +-- safe reads under RLS/server session
    +-- explicit operations
    |
Supabase
```

External:
```text
PlayHQ -> integration adapter -> internal fixture/result model
Expo Push -> APNs/FCM
Sentry
PostHog
```

---

## 4. Read vs command boundary

### Direct reads are allowed when
- RLS fully expresses access;
- data is non-privileged for that actor;
- query does not embed business decisions;
- no service role is required.

### Explicit application operations are required when
- mutation is privileged;
- multiple records must update atomically;
- audit event is required;
- domain invariants span records;
- notification/business events are emitted;
- external APIs are called;
- idempotency/concurrency matters;
- service role is necessary.

The client must never receive a service-role credential.

---

## 5. Domain rules

Domain/application code should be platform-neutral TypeScript wherever practical.

Examples:
- duty allocation fairness;
- duty swap state transition;
- attendance transition;
- fill-in eligibility abstraction;
- game stat validation;
- capability evaluation;
- fixture reconciliation.

Do not place these rules only in React components or SQL policy text.

---

## 6. Database invariants

Use the database for invariants it is uniquely good at enforcing:
- foreign keys;
- uniqueness;
- check constraints;
- not-null;
- tenant-linked composite constraints where valuable;
- atomic transactions;
- row-level security.

Do not duplicate the entire application domain in triggers.

Triggers require documented rationale and tests.

---

## 7. Events

Use explicit business events, not direct notification calls sprinkled through features.

Examples:
- FixtureChanged
- AttendanceUpdated
- TrainingChanged
- AnnouncementPublished
- DutyAssigned
- DutySwapRequested
- DutySwapAccepted
- FillInRequested
- CoachCheckedIn
- PostGameReviewCompleted

The feature owns the event meaning. Notification infrastructure decides delivery channels/templates.

---

## 8. Multi-tenancy

V1 is one club with many teams, but every persistent domain object must have a clear tenant path.

Prefer relational ownership:
Club -> Season/Team -> Events/etc.

Do not trust client-supplied `club_id` as proof of access.

Cross-club support must be possible later without changing child/user identity semantics.

---

## 9. UI sharing

Share:
- contracts;
- schemas;
- domain rules;
- API client;
- design tokens;
- test fixtures where safe.

Do not force-share React Native and web UI components. Platform-appropriate UI is allowed.

---

## 10. Dependency direction

Presentation -> contracts/application interfaces -> domain.

Infrastructure implements ports used by application/domain.

Integrations map external payloads into internal contracts.

No domain package imports:
- Expo;
- React;
- Next;
- Supabase client;
- PlayHQ DTOs;
- analytics SDKs.

---

## 11. Failure handling

Every external boundary must define:
- timeout;
- retry;
- idempotency;
- error mapping;
- observability;
- user-visible fallback.

PlayHQ outage must not make cached/local team operations unusable.

Push delivery failure must not roll back the business operation.

Analytics failure must never block user actions.

---

## 12. Performance

Initial targets:
- Home/Game Day critical content should render from cache quickly and refresh in background.
- Avoid N+1 roster/guardian queries.
- Use indexes based on measured query shapes.
- Paginate administrative history/notifications.
- Keep images out of MVP critical path.
