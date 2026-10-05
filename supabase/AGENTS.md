# Supabase Instructions

This area is owned by the Supabase/Data/RLS agent during active schema work.

## Non-negotiables
- all schema changes through migrations;
- RLS on exposed tenant/child tables;
- pgTAP tests for policies/invariants;
- no production changes;
- no destructive migration without human approval;
- clean local rebuild must succeed;
- generated types updated after migrations;
- no service-role logic in clients.

Coordinate local stack use when parallel worktrees exist.
