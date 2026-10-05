---
name: tdd-slice
description: Execute a vertical slice using test-first domain/application development and simultaneous integration/UI tests.
---
# TDD Slice
1. Confirm slice plan and acceptance scenarios.
2. Write failing domain/application tests.
3. Implement minimum domain/application behaviour.
4. Add persistence/RLS tests before relying on data access.
5. Implement adapter.
6. Implement UI against approved contract.
7. Add component/E2E coverage for user-observable critical behaviour.
8. Run scoped gates.
9. Run coverage.
10. Ask QA subagent for independent review when slice is critical.
Never weaken tests to get green.
