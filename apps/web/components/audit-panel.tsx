import { themeFor } from "@stable/design-tokens";

import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_CATEGORY_LABELS,
  AUDIT_TIME_ZONE,
  type AuditCategory,
  type SafeAuditAction,
} from "../lib/audit-view";

export type AuditEventView = {
  id: string;
  action: SafeAuditAction;
  actorUserId: string;
  targetId: string;
  createdAt: string;
};

export function AuditPanel({
  events,
  category,
  action,
  from,
  to,
  page,
  hasNext,
  error,
}: {
  events: readonly AuditEventView[];
  category: AuditCategory | null;
  action: SafeAuditAction | null;
  from: string | null;
  to: string | null;
  page: number;
  hasNext: boolean;
  error?: string;
}) {
  const theme = themeFor("mustangs");
  const categories = Object.keys(AUDIT_ACTIONS) as AuditCategory[];
  const availableActions =
    category === null
      ? Object.values(AUDIT_ACTIONS).flat()
      : AUDIT_ACTIONS[category];

  return (
    <section
      aria-labelledby="audit-heading"
      style={{
        background: theme.color.background.surface,
        border: `1px solid ${theme.color.border.default}`,
        borderRadius: theme.radius.lg,
        padding: theme.space[6],
      }}
    >
      <h1 id="audit-heading">Operational audit</h1>
      <p>
        Recent club structure, staff access, invitation and fixture changes.
        Coaching history and player details are not shown here.
      </p>
      {error === undefined ? null : <p role="alert">{error}</p>}

      <form method="get" aria-label="Filter audit events">
        <label>
          Category
          <select name="category" defaultValue={category ?? ""}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {AUDIT_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select name="action" defaultValue={action ?? ""}>
            <option value="">All actions</option>
            {availableActions.map((item) => (
              <option key={item} value={item}>
                {AUDIT_ACTION_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={from ?? ""} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={to ?? ""} />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      {events.length === 0 ? (
        <p role="status">No operational audit events match these filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption className="sr-only">
              Operational audit events. Times are shown in {AUDIT_TIME_ZONE}.
            </caption>
            <thead>
              <tr>
                <th scope="col">When ({AUDIT_TIME_ZONE})</th>
                <th scope="col">Category</th>
                <th scope="col">Action</th>
                <th scope="col">Actor reference</th>
                <th scope="col">Record reference</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatAuditTime(event.createdAt)}</td>
                  <td>{categoryForAction(event.action)}</td>
                  <td>{AUDIT_ACTION_LABELS[event.action]}</td>
                  <td>
                    <code>{event.actorUserId}</code>
                  </td>
                  <td>
                    <code>{event.targetId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Audit pages">
        {page > 1 ? (
          <a href={pageHref(page - 1, { category, action, from, to })}>
            Previous page
          </a>
        ) : null}
        <span aria-live="polite">Page {page}</span>
        {hasNext ? (
          <a href={pageHref(page + 1, { category, action, from, to })}>
            Next page
          </a>
        ) : null}
      </nav>
    </section>
  );
}

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: AUDIT_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function categoryForAction(action: SafeAuditAction): string {
  for (const [category, actions] of Object.entries(AUDIT_ACTIONS)) {
    if (actions.some((candidate) => candidate === action)) {
      return AUDIT_CATEGORY_LABELS[category as AuditCategory];
    }
  }
  return "Operational";
}

function pageHref(
  page: number,
  filters: {
    category: AuditCategory | null;
    action: SafeAuditAction | null;
    from: string | null;
    to: string | null;
  },
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (filters.category !== null) params.set("category", filters.category);
  if (filters.action !== null) params.set("action", filters.action);
  if (filters.from !== null) params.set("from", filters.from);
  if (filters.to !== null) params.set("to", filters.to);
  return `/audit?${params.toString()}`;
}
