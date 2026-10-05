export type DependencyAuditException = {
  package: string;
  advisory: string;
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function advisoryList(report: unknown): AuditAdvisory[] {
  if (!isRecord(report) || !isRecord(report.advisories)) {
    return [];
  }

  return Object.values(report.advisories).filter(isRecord);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * High and critical advisories that match the accepted exception list become
 * warnings. Any other high or critical advisory fails. A patched version for
 * an accepted advisory also fails, because the exception is no longer current.
 */
export function evaluateDependencyAudit(
  report: unknown,
  exceptions: readonly DependencyAuditException[],
): DependencyAuditResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  for (const advisory of advisoryList(report)) {
    const severity = text(advisory.severity);
    if (severity !== "high" && severity !== "critical") {
      continue;
    }

    const packageName = text(advisory.module_name) ?? "unknown";
    const advisoryId = text(advisory.github_advisory_id) ?? "unknown";
    const accepted = exceptions.some(
      (exception) =>
        exception.package === packageName && exception.advisory === advisoryId,
    );
    if (!accepted) {
      failures.push(
        `${severity} ${packageName} ${advisoryId} is not an accepted exception.`,
      );
      continue;
    }

    const patched = text(advisory.patched_versions);
    if (patched !== undefined) {
      failures.push(
        `${packageName} ${advisoryId} now has patched versions ${patched}.`,
      );
      continue;
    }

    warnings.push(
      `Accepted residual risk: ${severity} ${packageName} ${advisoryId}. Production release remains blocked.`,
    );
  }

  return { warnings, failures };
}
