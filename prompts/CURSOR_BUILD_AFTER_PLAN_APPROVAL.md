# Cursor Build Prompt — Use Only After Human Approves Plan

The Milestone 0 Plan has been reviewed and approved.

Re-read:
- root AGENTS.md;
- approved saved plan;
- ATRD;
- AGENT_WORKSTREAMS;
- TESTING;
- SECURITY;
- relevant ADRs.

Act as the Integrator.

## Execution rules
1. Freeze shared contracts/root config ownership first.
2. Create isolated worktrees/branches for independent workstreams.
3. Delegate only to the custom subagent that owns each area.
4. Include objective, owned paths, read-only dependencies, acceptance criteria, tests, forbidden changes and return evidence in every delegation.
5. Do not let two agents edit the same shared/root file concurrently.
6. Integrate in dependency order.
7. Run tests after each risky integration.
8. Run full Milestone 0 gate.
9. Ask QA and Security agents to review the integrated result.
10. Stop before any production mutation.

If implementation uncovers an architectural contradiction, stop that slice and propose an ADR instead of improvising around it.

Return progress and evidence, not optimistic summaries.
