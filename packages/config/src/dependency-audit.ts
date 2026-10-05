export type DependencyAuditException = {
  package: string;
  advisory: string;
  classification: "tooling";
  allowedPathFragments: readonly string[];
};

export type DependencyAuditExceptions = {
  productionStatus: string;
  advisories: readonly DependencyAuditException[];
};

export type DependencyAuditResult = {
  warnings: string[];
  failures: string[];
};

type AuditAdvisory = {
  module_name?: unknown;
  severity?: unknown;
  github_advisory_id?: unknown;
  patched_versions?: unknown;
  findings?: unknown;
};

const INCOMPLETE_AUDIT = "Audit report is incomplete or malformed.";
const PRODUCTION_STAYS_BLOCKED =
  "Production release stays blocked while an accepted advisory remains open.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function vulnerabilityCount(
  report: Record<string, unknown>,
  severity: "high" | "critical",
): number | undefined {
  if (
    !isRecord(report.metadata) ||
    !isRecord(report.metadata.vulnerabilities)
  ) {
    return undefined;
  }
  const count = report.metadata.vulnerabilities[severity];
  return typeof count === "number" ? count : undefined;
}

function advisoryEntries(
  report: Record<string, unknown>,
): AuditAdvisory[] | undefined {
  if (!isRecord(report.advisories)) {
    return undefined;
  }

  const entries: AuditAdvisory[] = [];
  for (const value of Object.values(report.advisories)) {
    if (!isRecord(value)) {
      return undefined;
    }
    entries.push(value);
  }
  return entries;
}

function isCompleteAuditReport(
  report: unknown,
): report is Record<string, unknown> {
  if (!isRecord(report)) {
    return false;
  }

  const high = vulnerabilityCount(report, "high");
  const critical = vulnerabilityCount(report, "critical");
  const entries = advisoryEntries(report);
  if (high === undefined || critical === undefined || entries === undefined) {
    return false;
  }

  const counted = { high: 0, critical: 0 };
  for (const entry of entries) {
    const severity = text(entry.severity);
    if (severity === "high" || severity === "critical") {
      counted[severity] += 1;
    }
  }

  return counted.high === high && counted.critical === critical;
}

function findingPaths(advisory: AuditAdvisory): string[] | undefined {
  if (!Array.isArray(advisory.findings)) {
    return undefined;
  }

  const paths: string[] = [];
  for (const finding of advisory.findings) {
    if (!isRecord(finding) || !Array.isArray(finding.paths)) {
      return undefined;
    }
    for (const path of finding.paths) {
      if (typeof path !== "string" || path.length === 0) {
        return undefined;
      }
      paths.push(path);
    }
  }

  return paths.length === 0 ? undefined : paths;
}

function exceptionKey(packageName: string, advisoryId: string): string {
  return `${packageName} ${advisoryId}`;
}

function isToolingPath(path: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => path.includes(fragment));
}

export function parseDependencyAuditExceptions(
  value: unknown,
): DependencyAuditExceptions {
  if (!isRecord(value) || !Array.isArray(value.advisories)) {
    throw new Error("Dependency exception file is invalid.");
  }

  const productionStatus = text(value.productionStatus);
  if (productionStatus === undefined) {
    throw new Error("Dependency exception file is missing productionStatus.");
  }

  const advisories: DependencyAuditException[] = [];
  for (const entry of value.advisories) {
    if (!isRecord(entry) || entry.classification !== "tooling") {
      throw new Error("Dependency exception entry is invalid.");
    }
    const packageName = text(entry.package);
    const advisoryId = text(entry.advisory);
    if (
      packageName === undefined ||
      advisoryId === undefined ||
      !Array.isArray(entry.allowedPathFragments) ||
      entry.allowedPathFragments.length === 0
    ) {
      throw new Error("Dependency exception entry is invalid.");
    }

    const allowedPathFragments: string[] = [];
    for (const fragment of entry.allowedPathFragments) {
      if (typeof fragment !== "string" || fragment.length === 0) {
        throw new Error("Dependency exception entry is invalid.");
      }
      allowedPathFragments.push(fragment);
    }

    advisories.push({
      package: packageName,
      advisory: advisoryId,
      classification: "tooling",
      allowedPathFragments,
    });
  }

  return { productionStatus, advisories };
}

/**
 * Accepted highs stay warnings only on the reviewed tooling paths.
 * Any other high or critical fails. A complete report that no longer
 * contains a declared exception also fails, so the exception file has to
 * be updated. An incomplete report fails without claiming the advisory
 * left the graph.
 */
export function evaluateDependencyAudit(
  report: unknown,
  exceptions: readonly DependencyAuditException[],
  productionStatus: string,
): DependencyAuditResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  if (exceptions.length > 0 && productionStatus !== "BLOCKED") {
    failures.push(PRODUCTION_STAYS_BLOCKED);
  }

  if (!isCompleteAuditReport(report)) {
    failures.push(INCOMPLETE_AUDIT);
    return { warnings, failures };
  }

  const seen = new Set<string>();
  for (const advisory of advisoryEntries(report) ?? []) {
    const severity = text(advisory.severity);
    if (severity !== "high" && severity !== "critical") {
      continue;
    }

    const packageName = text(advisory.module_name) ?? "unknown";
    const advisoryId = text(advisory.github_advisory_id) ?? "unknown";
    const accepted = exceptions.find(
      (exception) =>
        exception.package === packageName && exception.advisory === advisoryId,
    );
    if (accepted === undefined) {
      failures.push(
        `${severity} ${packageName} ${advisoryId} is not an accepted exception.`,
      );
      continue;
    }

    seen.add(exceptionKey(packageName, advisoryId));
    const patched = text(advisory.patched_versions);
    if (patched !== undefined) {
      failures.push(
        `${packageName} ${advisoryId} now has patched versions ${patched}.`,
      );
      continue;
    }

    const paths = findingPaths(advisory);
    if (paths === undefined) {
      failures.push(
        `${packageName} ${advisoryId} has no dependency path in the audit result.`,
      );
      continue;
    }

    const runtimePath = paths.find(
      (path) => !isToolingPath(path, accepted.allowedPathFragments),
    );
    if (runtimePath !== undefined) {
      failures.push(
        `${packageName} ${advisoryId} is outside the reviewed tooling path: ${runtimePath}`,
      );
      continue;
    }

    warnings.push(
      `Accepted residual risk: ${severity} ${packageName} ${advisoryId}. Production release remains blocked.`,
    );
  }

  for (const exception of exceptions) {
    if (seen.has(exceptionKey(exception.package, exception.advisory))) {
      continue;
    }
    failures.push(
      `${exception.package} ${exception.advisory} is no longer present in the dependency graph. Update or remove the exception record.`,
    );
  }

  return { warnings, failures };
}
