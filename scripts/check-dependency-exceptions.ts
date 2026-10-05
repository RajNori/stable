import { readFileSync } from "node:fs";

import {
  evaluateDependencyAudit,
  parseDependencyAuditExceptions,
} from "../packages/config/src/dependency-audit.ts";

const auditPath = process.argv[2];
if (auditPath === undefined || auditPath.length === 0) {
  console.error("Usage: check-dependency-exceptions.ts <pnpm-audit.json>");
  process.exitCode = 1;
} else {
  const exceptionPath = new URL(
    "../planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json",
    import.meta.url,
  );
  try {
    const exceptions = parseDependencyAuditExceptions(
      JSON.parse(readFileSync(exceptionPath, "utf8")),
    );
    const result = evaluateDependencyAudit(
      JSON.parse(readFileSync(auditPath, "utf8")),
      exceptions.advisories,
      exceptions.productionStatus,
    );
    for (const warning of result.warnings) {
      console.log(`::warning::${warning}`);
    }
    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        console.error(failure);
      }
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "check failed";
    console.error(message);
    process.exitCode = 1;
  }
}
