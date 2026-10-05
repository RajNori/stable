---
name: release-gate
description: Verify a The Stable release candidate against product, security, quality, environment and evidence gates without deploying it.
disable-model-invocation: true
---
# Release Gate
Read `planning/RELEASE.md`.
Collect SHA, migrations, tests, coverage, security review, builds and known issues.
Return PASS / PASS WITH CONDITIONS / FAIL.
Do not deploy.
