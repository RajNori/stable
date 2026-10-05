# Testing Strategy

## Philosophy

The Stable uses:
- BDD for acceptance contracts;
- TDD for domain/application behaviour;
- integration tests for real boundaries;
- RLS/database tests for authorization/invariants;
- component tests for UI behaviour;
- E2E only for critical journeys.

Tests are implemented with the feature.

## Coverage gates

### Absolute behavioural gates
- 100% capability matrix behaviour covered.
- Every RLS policy has allow + deny coverage.
- Every state machine transition has valid + invalid transition tests.
- Critical concurrency operations have race tests.
- Critical integration mapping has success + malformed/upstream failure tests.

### Numerical targets for hand-written testable code
Pilot release target:
- lines >= 95%;
- statements >= 95%;
- functions >= 95%;
- branches >= 90%.

Critical permission/domain policy modules target 100% branches where meaningful.

Exclude with explicit config/rationale:
- generated Supabase types;
- generated Expo/native artefacts;
- declarative config with no executable behaviour;
- migrations from JS coverage (migrations are covered by DB tests);
- unreachable platform shims documented as such.

Never add meaningless tests only to paint uncovered lines green.

## Layers

### Unit
Vitest.
Targets:
- policies;
- use cases;
- validators;
- mappers;
- duty allocator;
- recurrence logic;
- stats validation;
- fixture reconciliation.

### Database
Supabase local + pgTAP.
Targets:
- schema;
- constraints;
- indexes where critical;
- RLS;
- SQL functions/RPC;
- migration assumptions.

### Integration
Run against local Supabase.
Targets:
- use case to database;
- auth context;
- edge/server operation;
- PlayHQ mapping with fixtures;
- push adapter with test double.

### Mobile components
React Native Testing Library.
Test accessible user behaviour, not internal component structure.

### Web
Testing Library plus Playwright for critical admin flows.

### Mobile E2E
Maestro for a small set of release-critical journeys.

## BDD convention

Each feature gets scenarios stored either adjacent to tests or documented in the slice plan.

Minimum scenarios:
- happy path;
- validation failure;
- unauthorized actor;
- wrong tenant;
- revoked access where applicable;
- offline/upstream failure where applicable;
- concurrency/idempotency where applicable.

## Critical E2E

Guardian:
invite -> auth -> child/team -> Game Day -> RSVP.

Coach:
auth -> roster availability -> enter stats -> post-game review -> next practice focus.

Manager:
auth -> create/update manual fixture -> assign duty -> publish announcement -> fill-in request.

Club Admin:
auth -> create/manage team -> invite staff/guardian -> verify scoped access.

Security:
Team A user mutates/reads Team B identifier -> denied.

Offline:
load Game Day online -> lose network -> reopen cached Game Day -> stale timestamp visible.

## CI
PR:
- format;
- lint;
- typecheck;
- unit;
- coverage;
- DB tests;
- RLS tests;
- integration;
- web build;
- Expo doctor/config validation;
- selected E2E depending change scope.

Nightly/merge:
- broader Playwright;
- Maestro if environment available;
- security scans.

## Flaky tests
No "retry until green" policy.
A flaky test is a defect.
Quarantine only with issue, owner, rationale and deadline.
