import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  evaluateDependencyAudit,
  parseDependencyAuditExceptions,
} from "./dependency-audit.js";
import type { DependencyAuditException } from "./dependency-audit.js";

const exceptionFile = fileURLToPath(
  new URL(
    "../../../planning/security-exceptions/2026-10-05-expo-metro-high-advisories.json",
    import.meta.url,
  ),
);

function exceptionFileJson(): unknown {
  return JSON.parse(readFileSync(exceptionFile, "utf8"));
}

function exceptions(): {
  productionStatus: string;
  advisories: readonly DependencyAuditException[];
} {
  return parseDependencyAuditExceptions(exceptionFileJson());
}

function report(
  advisories: Record<string, unknown>,
  high: number,
  critical = 0,
): unknown {
  return {
    advisories,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high, critical },
      dependencies: 1,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: 1,
    },
  };
}

function advisory(
  packageName: string,
  advisoryId: string,
  paths: string[],
  patched: string | null = null,
): unknown {
  return {
    module_name: packageName,
    severity: "high",
    github_advisory_id: advisoryId,
    patched_versions: patched,
    findings: [{ version: "0.0.0", paths }],
  };
}

const FORGE_PATH = "apps__mobile>expo>@expo/cli>node-forge";
const FORGE_SIGNING_PATH =
  "apps__mobile>expo>@expo/cli>@expo/code-signing-certificates>node-forge";
const BRACES_PATH =
  "apps__mobile>react-native>metro>metro-file-map>micromatch>braces";

describe("dependency audit exceptions", () => {
  it("records the two unpatched tooling advisories as blocked", () => {
    const parsed = exceptions();
    expect(exceptionFileJson()).toMatchObject({
      reviewedBy: "Integrator",
      reviewedOn: "2026-10-05",
      productionStatus: "BLOCKED",
    });
    expect(parsed.advisories.map((entry) => entry.package)).toEqual([
      "node-forge",
      "braces",
    ]);
    expect(parsed.advisories.map((entry) => entry.advisory)).toEqual([
      "GHSA-86w9-cpqp-85rv",
      "GHSA-vfj7-8cjw-p6xm",
    ]);
    expect(
      parsed.advisories.every((entry) => entry.classification === "tooling"),
    ).toBe(true);
    expect(parsed.advisories[0]?.allowedPathFragments).toEqual([
      "@expo/cli>node-forge",
      "@expo/cli>@expo/code-signing-certificates>node-forge",
    ]);
    expect(parsed.advisories[1]?.allowedPathFragments).toContain(
      "metro-file-map>micromatch>braces",
    );
  });

  it("warns on the reviewed tooling paths and fails any other high or critical", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [
            FORGE_PATH,
            FORGE_SIGNING_PATH,
          ]),
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
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
        2,
        1,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(result.warnings).toHaveLength(2);
    expect(result.failures).toEqual([
      "critical left-pad GHSA-example is not an accepted exception.",
    ]);
  });

  it("fails a malformed report without treating an exception as removed", () => {
    const parsed = exceptions();
    const missing = evaluateDependencyAudit(
      null,
      parsed.advisories,
      parsed.productionStatus,
    );
    const broken = evaluateDependencyAudit(
      { advisories: { bad: null } },
      parsed.advisories,
      parsed.productionStatus,
    );
    const mismatched = evaluateDependencyAudit(
      report(
        {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [FORGE_PATH]),
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        1,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    for (const result of [missing, broken, mismatched]) {
      expect(result.warnings).toEqual([]);
      expect(result.failures).toEqual([
        "Audit report is incomplete or malformed.",
      ]);
      expect(result.failures.join(" ")).not.toMatch(/no longer present/);
    }
  });

  it("requires the exception file to change when an advisory leaves a complete report", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [FORGE_PATH]),
        },
        1,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.failures).toEqual([
      "braces GHSA-vfj7-8cjw-p6xm is no longer present in the dependency graph. Update or remove the exception record.",
    ]);
  });

  it("fails when an accepted advisory leaves the reviewed tooling path", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [
            "apps__web>node-forge",
          ]),
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [
            "packages__features>braces",
          ]),
        },
        2,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(result.warnings).toEqual([]);
    expect(result.failures[0]).toMatch(/outside the reviewed tooling path/);
    expect(result.failures[1]).toMatch(/outside the reviewed tooling path/);
  });

  it("fails when an accepted advisory gains a patched version", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: advisory(
            "node-forge",
            "GHSA-86w9-cpqp-85rv",
            [FORGE_PATH],
            ">=1.4.1",
          ),
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        2,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(result.failures[0]).toMatch(/patched versions/);
  });

  it("fails when an accepted advisory has no path", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: {
            module_name: "node-forge",
            severity: "high",
            github_advisory_id: "GHSA-86w9-cpqp-85rv",
            patched_versions: null,
            findings: [],
          },
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        2,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(result.failures[0]).toMatch(/no dependency path/);
  });

  it("rejects an exception file that cannot be checked", () => {
    expect(() => parseDependencyAuditExceptions(null)).toThrow(
      /exception file is invalid/,
    );
    expect(() => parseDependencyAuditExceptions({ advisories: [] })).toThrow(
      /productionStatus/,
    );
    expect(() =>
      parseDependencyAuditExceptions({
        productionStatus: "",
        advisories: [],
      }),
    ).toThrow(/productionStatus/);
    expect(() =>
      parseDependencyAuditExceptions({
        productionStatus: "BLOCKED",
        advisories: [{ classification: "runtime" }],
      }),
    ).toThrow(/exception entry is invalid/);
    expect(() =>
      parseDependencyAuditExceptions({
        productionStatus: "BLOCKED",
        advisories: [
          {
            package: "",
            advisory: "GHSA-example",
            classification: "tooling",
            allowedPathFragments: ["tool>pkg"],
          },
        ],
      }),
    ).toThrow(/exception entry is invalid/);
    expect(() =>
      parseDependencyAuditExceptions({
        productionStatus: "BLOCKED",
        advisories: [
          {
            package: "node-forge",
            advisory: "GHSA-86w9-cpqp-85rv",
            classification: "tooling",
            allowedPathFragments: [""],
          },
        ],
      }),
    ).toThrow(/exception entry is invalid/);
  });

  it("treats a non-numeric severity count and a blank path as incomplete evidence", () => {
    const parsed = exceptions();
    const badCount = evaluateDependencyAudit(
      {
        advisories: {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [FORGE_PATH]),
        },
        metadata: { vulnerabilities: { high: "2", critical: 0 } },
      },
      parsed.advisories,
      parsed.productionStatus,
    );
    const blankPath = evaluateDependencyAudit(
      report(
        {
          forge: {
            module_name: "node-forge",
            severity: "high",
            github_advisory_id: "GHSA-86w9-cpqp-85rv",
            findings: [{ paths: [""] }],
          },
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        2,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );
    const numericPath = evaluateDependencyAudit(
      report(
        {
          forge: {
            module_name: "node-forge",
            severity: "high",
            github_advisory_id: "GHSA-86w9-cpqp-85rv",
            findings: [{ paths: [1] }],
          },
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        2,
      ),
      parsed.advisories,
      parsed.productionStatus,
    );

    expect(badCount.failures).toEqual([
      "Audit report is incomplete or malformed.",
    ]);
    expect(blankPath.failures[0]).toMatch(/no dependency path/);
    expect(numericPath.failures[0]).toMatch(/no dependency path/);
  });

  it("keeps production blocked while an accepted advisory remains open", () => {
    const parsed = exceptions();
    const result = evaluateDependencyAudit(
      report(
        {
          forge: advisory("node-forge", "GHSA-86w9-cpqp-85rv", [FORGE_PATH]),
          braces: advisory("braces", "GHSA-vfj7-8cjw-p6xm", [BRACES_PATH]),
        },
        2,
      ),
      parsed.advisories,
      "OPEN",
    );

    expect(result.failures).toContain(
      "Production release stays blocked while an accepted advisory remains open.",
    );
  });
});
