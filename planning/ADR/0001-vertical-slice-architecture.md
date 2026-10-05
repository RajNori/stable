# ADR 0001 — Vertical Slice Architecture
Status: Accepted

## Context
The product spans mobile, web, Postgres, auth, notifications and external integrations. Parallel agents increase the risk of horizontal-layer drift.

## Decision
Use Vertical Slice Architecture. Organise business code by capability. Platform UI remains app-specific. Shared horizontal packages are allowed only for true cross-cutting concerns.

## Consequences
Positive: clearer feature ownership, safer parallel work, behaviour-focused tests.
Trade-off: some deliberate duplication may exist at presentation edges.
