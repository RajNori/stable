import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { evaluateDependencyAudit } from "./dependency-audit.js";

const exceptionFile = fileURLToPath(
  new URL(
    "../../../planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json",
    import.meta.url,
  ),
);

function exceptions(): { package: string; advisory: string }[] {
  const parsed: unknown = JSON.parse(readFileSync(exceptionFile, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("advisories" in parsed)
  ) {
    throw new Error("exception file is missing advisories");
  }
  const advisories = parsed.advisories;
  if (!Array.isArray(advisories)) {
    throw new Error("exception advisories must be an array");
  }
  return advisories.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("package" in entry) ||
      !("advisory" in entry) ||
      typeof entry.package !== "string" ||
      typeof entry.advisory !== "string"
    ) {
      throw new Error("exception advisory is incomplete");
    }
    return { package: entry.package, advisory: entry.advisory };
  });
}

describe("dependency audit exceptions", () => {
  it("records the two unpatched Expo and Metro advisories as blocked", () => {
    const parsed: unknown = JSON.parse(readFileSync(exceptionFile, "utf8"));
    expect(parsed).toMatchObject({
      reviewedBy: "Integrator",
      reviewedOn: "2026-10-05",
      productionStatus: "BLOCKED",
    });
    expect(exceptions()).toEqual([
      { package: "node-forge", advisory: "GHSA-86w9-cpqp-85rv" },
      { package: "braces", advisory: "GHSA-vfj7-8cjw-p6xm" },
    ]);
  });

  it("warns on the accepted highs and fails on any other high or critical", () => {
    const result = evaluateDependencyAudit(
      {
        advisories: {
          forge: {
            module_name: "node-forge",
            severity: "high",
            github_advisory_id: "GHSA-86w9-cpqp-85rv",
            patched_versions: null,
          },
          braces: {
            module_name: "braces",
            severity: "high",
            github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
          },
          other: {
            module_name: "left-pad",
            severity: "critical",
            github_advisory_id: "GHSA-example",
          },
          moderate: {
            module_name: "uuid",
            severity: "moderate",
            github_advisory_id: "GHSA-moderate",
          },
        },
      },
      exceptions(),
    );

    expect(result.warnings).toHaveLength(2);
    expect(result.failures).toEqual([
      "critical left-pad GHSA-example is not an accepted exception.",
    ]);
  });

  it("ignores a report that has no advisory object", () => {
    expect(evaluateDependencyAudit(null, exceptions())).toEqual({
      warnings: [],
      failures: [],
    });
    expect(
      evaluateDependencyAudit({ advisories: { bad: null } }, exceptions()),
    ).toEqual({ warnings: [], failures: [] });
  });

  it("fails when an accepted advisory gains a patched version", () => {
    const result = evaluateDependencyAudit(
      {
        advisories: {
          forge: {
            module_name: "node-forge",
            severity: "high",
            github_advisory_id: "GHSA-86w9-cpqp-85rv",
            patched_versions: ">=1.4.1",
          },
        },
      },
      exceptions(),
    );

    expect(result.failures[0]).toMatch(/patched versions/);
  });
});
