# Residual risk: Expo CLI node-forge and Metro braces

Reviewed by Integrator on 2026-10-05. Production status: **BLOCKED**.

This file is the human-readable copy of `2026-10-05-expo-metro-high-advisories.json`. The dependency-audit job warns on these two advisories and fails on any other high or critical advisory. It does not lower `pnpm audit --audit-level=high` and it does not mean the advisories are fixed.

Review again when an upstream patch is published, when Expo or Metro is upgraded, or before any production Supabase, Vercel, or EAS release.

## node-forge GHSA-86w9-cpqp-85rv

- Package: `node-forge`
- Severity: high
- Patched versions: none
- Transitive path: `apps/mobile > expo > @expo/cli > node-forge`, and `@expo/code-signing-certificates`
- Affected path: Expo CLI and code-signing toolchain
- Exploitability: RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements. Not on the club, profile, or child-data request path.
- Why there is no patch: the npm advisory lists no patched version.
- Compensating controls: Milestone 0 does not run EAS build or code signing.
- Production release: blocked until a patch is applied or this residual risk is explicitly re-accepted for production.

## braces GHSA-vfj7-8cjw-p6xm

- Package: `braces`
- Severity: high
- Patched versions: none
- Transitive path: `apps/mobile > react-native > Metro > metro-file-map > micromatch > braces`
- Affected path: Metro bundler and Jest file-map glob compilation
- Exploitability: deeply nested brace patterns can exhaust the stack while a glob is compiled. That input is the build and test runner, not a request.
- Why there is no patch: the npm advisory lists no patched version.
- Compensating controls: application code does not pass user input to micromatch.
- Production release: blocked until a patch is applied or this residual risk is explicitly re-accepted for production.
