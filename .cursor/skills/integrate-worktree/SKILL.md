---
name: integrate-worktree
description: Integrate one or more isolated agent worktrees safely into the integration branch with contract and test verification.
disable-model-invocation: true
---
# Integrate Worktree
1. Confirm each branch has evidence and clean status.
2. Review scope for path-ownership violations.
3. Integrate dependency-first.
4. Resolve conflicts by approved contract, never whichever side is newer.
5. Run scoped tests after each risky merge.
6. Run full required gate.
7. Request QA/security review as required.
8. Do not push/deploy production.
