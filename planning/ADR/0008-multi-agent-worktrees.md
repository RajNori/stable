# ADR 0008 — Isolated Worktrees for Parallel Agents
Status: Accepted

## Decision
Concurrent editing agents use isolated worktrees/branches. Shared checkout parallel editing is prohibited for overlapping implementation work.

## Consequence
Integrator owns merge order and conflict resolution.
