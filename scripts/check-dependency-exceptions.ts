import { readFileSync } from "node:fs";

import { evaluateDependencyAudit } from "../packages/config/src/dependency-audit.ts";
import type { DependencyAuditException } from "../packages/config/src/dependency-audit.ts";

const auditPath = process.argv[2];
if (auditPath === undefined || auditPath.length === 0) {
  console.error("Usage: check-dependency-exceptions.ts <pnpm-audit.json>");
  process.exitCode = 1;
} else {
  const exceptionPath = new URL(
    "../planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json",
    import.meta.url,
  );
  const exceptionJson: unknown = JSON.parse(
    readFileSync(exceptionPath, "utf8"),
  );
  const auditJson: unknown = JSON.parse(readFileSync(auditPath, "utf8"));
  if (
    typeof exceptionJson !== "object" ||
    exceptionJson === null ||
    !("advisories" in exceptionJson) ||
    !Array.isArray(exceptionJson.advisories)
  ) {
    console.error("Dependency exception file is invalid.");
    process.exitCode = 1;
  } else {
    const exceptions: DependencyAuditException[] = [];
    for (const entry of exceptionJson.advisories) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("package" in entry) ||
        !("advisory" in entry) ||
        typeof entry.package !== "string" ||
        typeof entry.advisory !== "string"
      ) {
        console.error("Dependency exception entry is invalid.");
        process.exitCode = 1;
        break;
      }
      exceptions.push({ package: entry.package, advisory: entry.advisory });
    }

    if (process.exitCode !== 1) {
      const result = evaluateDependencyAudit(auditJson, exceptions);
      for (const warning of result.warnings) {
        console.log(`::warning::${warning}`);
      }
      if (result.failures.length > 0) {
        for (const failure of result.failures) {
          console.error(failure);
        }
        process.exitCode = 1;
      } else if (result.warnings.length === 0) {
        console.error(
          "No accepted high advisories were present. Update the exception file instead of passing silently.",
        );
        process.exitCode = 1;
      }
    }
  }
}
