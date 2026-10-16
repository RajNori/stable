export const AUDIT_PAGE_SIZE = 25;
export const AUDIT_TIME_ZONE = "Australia/Melbourne";

export const AUDIT_ACTIONS = {
  structure: [
    "season.created",
    "season.updated",
    "competition.created",
    "competition.updated",
    "team.created",
    "team.updated",
    "venue.created",
    "venue.updated",
  ],
  access: [
    "team_staff.assigned",
    "team_staff.reactivated",
    "team_staff.revoked",
    "invitation.created",
    "invitation.accepted",
    "invitation.revoked",
  ],
  schedule: [
    "fixture.created",
    "fixture.imported",
    "fixture.official_updated",
    "fixture.overlay_updated",
  ],
} as const;

export type AuditCategory = keyof typeof AUDIT_ACTIONS;
export type SafeAuditAction = (typeof AUDIT_ACTIONS)[AuditCategory][number];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  structure: "Club structure",
  access: "Staff and invitations",
  schedule: "Fixtures",
};

export const AUDIT_ACTION_LABELS: Record<SafeAuditAction, string> = {
  "season.created": "Season created",
  "season.updated": "Season updated",
  "competition.created": "Competition created",
  "competition.updated": "Competition updated",
  "team.created": "Team created",
  "team.updated": "Team updated",
  "venue.created": "Venue created",
  "venue.updated": "Venue updated",
  "team_staff.assigned": "Staff assigned",
  "team_staff.reactivated": "Staff access reactivated",
  "team_staff.revoked": "Staff access revoked",
  "invitation.created": "Invitation created",
  "invitation.accepted": "Invitation accepted",
  "invitation.revoked": "Invitation revoked",
  "fixture.created": "Fixture created",
  "fixture.imported": "Fixture imported",
  "fixture.official_updated": "Official fixture updated",
  "fixture.overlay_updated": "Fixture details updated",
};

export type AuditFilters = {
  category: AuditCategory | null;
  action: SafeAuditAction | null;
  from: string | null;
  to: string | null;
  page: number;
};

export function parseAuditFilters(
  params: Record<string, string | string[] | undefined>,
): AuditFilters {
  const categoryValue = first(params.category);
  const category = isAuditCategory(categoryValue) ? categoryValue : null;
  const actionValue = first(params.action);
  const action = isSafeAuditAction(actionValue) ? actionValue : null;
  const from = validCalendarDate(first(params.from));
  const to = validCalendarDate(first(params.to));
  const rawPage = first(params.page);
  const parsedPage = rawPage === undefined ? 1 : Number(rawPage);
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage >= 1
      ? Math.min(parsedPage, 1000)
      : 1;

  return {
    category,
    action:
      category !== null &&
      action !== null &&
      !AUDIT_ACTIONS[category].some((candidate) => candidate === action)
        ? null
        : action,
    from: from !== null && to !== null && from > to ? null : from,
    to: from !== null && to !== null && from > to ? null : to,
    page,
  };
}

export function actionsForFilters(
  filters: AuditFilters,
): readonly SafeAuditAction[] {
  if (filters.action !== null) return [filters.action];
  if (filters.category !== null) return AUDIT_ACTIONS[filters.category];
  return Object.values(AUDIT_ACTIONS).flat();
}

export function melbourneDateStart(date: string): string | null {
  const parsed = validCalendarDate(date);
  if (parsed === null) return null;
  const [year, month, day] = calendarParts(parsed);
  const wantedWallClock = Date.UTC(year, month - 1, day);
  let candidate = wantedWallClock;
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: AUDIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Map(
      formatter
        .formatToParts(new Date(candidate))
        .map((part) => [part.type, part.value]),
    );
    const representedWallClock = Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
      Number(parts.get("hour")),
      Number(parts.get("minute")),
      Number(parts.get("second")),
    );
    const difference = wantedWallClock - representedWallClock;
    if (difference === 0) return new Date(candidate).toISOString();
    candidate += difference;
  }

  return null;
}

export function nextCalendarDate(date: string): string | null {
  const parsed = validCalendarDate(date);
  if (parsed === null) return null;
  const [year, month, day] = calendarParts(parsed);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function isAuditCategory(
  value: string | undefined,
): value is AuditCategory {
  return value !== undefined && Object.hasOwn(AUDIT_ACTIONS, value);
}

export function isSafeAuditAction(
  value: string | undefined,
): value is SafeAuditAction {
  return (
    value !== undefined &&
    Object.values(AUDIT_ACTIONS).some((actions) =>
      actions.some((action) => action === value),
    )
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validCalendarDate(value: string | undefined): string | null {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = calendarParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function calendarParts(value: string): [number, number, number] {
  return [
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)),
    Number(value.slice(8, 10)),
  ];
}
